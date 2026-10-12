import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AgentsService } from '../src/agents/agents.service';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

type PromptMessage = { role: string; content: unknown };
type ToolCall = { toolName: string; input: Record<string, unknown> };
/** What the model does on one call: say something, or call tools. */
type ModelStep = { text: string } | { toolCalls: ToolCall[] };

describe('Thread task subscriptions E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let userActorId: string;
  let agentActorId: string;
  let dataSource: DataSource;

  const prompts: PromptMessage[][] = [];
  /** Steps the model plays next, in order. With none left it replies with plain text. */
  const script: ModelStep[] = [];
  let callCount = 0;

  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  };

  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Thread title' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
    doStream: async (options) => {
      prompts.push(options.prompt as PromptMessage[]);
      const call = ++callCount;
      const step = script.shift() ?? { text: `Reply ${call}` };

      const chunks =
        'text' in step
          ? [
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: step.text },
              { type: 'text-end' as const, id: 't' },
              { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage },
            ]
          : [
              ...step.toolCalls.map((toolCall, index) => ({
                type: 'tool-call' as const,
                toolCallId: `call-${call}-${index}`,
                toolName: toolCall.toolName,
                input: JSON.stringify(toolCall.input),
              })),
              { type: 'finish' as const, finishReason: { unified: 'tool-calls' as const, raw: undefined }, usage },
            ];

      return { stream: simulateReadableStream({ chunks }) };
    },
  });

  const createThread = async (): Promise<string> => {
    const response = await request(httpServer)
      .post('/api/v1/threads')
      .set('Cookie', authCookies)
      .send({ title: 'Subscriptions thread' })
      .expect(201);
    return response.body.id;
  };

  const createTask = async (name: string): Promise<string> => {
    const response = await request(httpServer)
      .post('/api/v1/tasks/tasks')
      .set('Cookie', authCookies)
      .send({ name, description: 'A task the thread waits for', assigneeActorId: userActorId })
      .expect(201);
    return response.body.id;
  };

  const setStatus = async (taskId: string, status: string): Promise<void> => {
    await request(httpServer)
      .patch(`/api/v1/tasks/tasks/${taskId}/status`)
      .set('Cookie', authCookies)
      .send({ status, ...(status === 'DONE' ? { comment: 'Finished' } : {}) })
      .expect(200);
  };

  const sendMessage = async (threadId: string, content: string): Promise<void> => {
    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Cookie', authCookies)
      .send({ content })
      .expect(201);
  };

  const subscribedTaskIds = async (threadId: string): Promise<string[]> => {
    const response = await request(httpServer)
      .get(`/api/v1/threads/${threadId}`)
      .set('Cookie', authCookies)
      .expect(200);
    return response.body.taskSubscriptions.map((s: { taskId: string }) => s.taskId);
  };

  const agentReplies = async (threadId: string): Promise<string[]> => {
    const rows: Array<{ content: string }> = await dataSource.query(
      `SELECT content FROM thread_messages
        WHERE thread_id = $1 AND created_by_actor_id = $2 ORDER BY created_at ASC`,
      [threadId, agentActorId],
    );
    return rows.map((row) => row.content);
  };

  /** Waits until the thread has had `count` agent turns and none is running. */
  const waitForTurns = async (threadId: string, count: number): Promise<void> => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const turns: Array<{ status: string }> = await dataSource.query(
        `SELECT status FROM thread_turns WHERE thread_id = $1`,
        [threadId],
      );
      if (turns.length >= count && turns.every((turn) => turn.status !== 'running')) {
        expect(turns.map((turn) => turn.status)).toEqual(turns.map(() => 'completed'));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${count} agent turns`);
  };

  const notifications = async (threadId: string): Promise<string[]> => {
    const rows: Array<{ message: { content: string } }> = await dataSource.query(
      `SELECT message FROM thread_agent_messages
        WHERE thread_id = $1 AND source = 'subscription:task' AND kind = 'injection'
        ORDER BY created_at ASC`,
      [threadId],
    );
    return rows.map((row) => row.message.content);
  };

  /** A thread whose agent subscribed to the given tasks while answering the user. */
  const threadSubscribedTo = async (taskIds: string[]): Promise<string> => {
    const threadId = await createThread();
    script.push(
      {
        toolCalls: taskIds.map((taskId) => ({
          toolName: 'subscribe_to_task',
          input: { taskId },
        })),
      },
      { text: 'I will let you know when it is ready.' },
    );
    await sendMessage(threadId, 'find the public holidays');
    await waitForTurns(threadId, 1);
    return threadId;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ChatModelFactory)
      .useValue({
        resolve: async () => ({ model, providerType: 'mock', modelId: 'mock-model-id' }),
      })
      .overrideProvider(TaicoMcpToolsFactory)
      .useValue({ open: async () => ({ tools: {}, close: async () => undefined }) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');

    await app.init();
    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);

    userActorId = await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
    agentActorId = (await app.get(AgentsService).getAgentBySlug({ slug: 'taico' })).actorId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    expect(script).toEqual([]);
  });

  it('wakes the agent when a subscribed task is done, then unsubscribes', async () => {
    const taskId = await createTask('Find public holidays');
    const threadId = await threadSubscribedTo([taskId]);

    expect(await subscribedTaskIds(threadId)).toEqual([taskId]);

    await setStatus(taskId, 'IN_PROGRESS');
    script.push({ text: 'The public holidays are in.' });
    await setStatus(taskId, 'DONE');
    await waitForTurns(threadId, 2);

    const [notification] = await notifications(threadId);
    expect(notification).toContain(`<task-notification task-id="${taskId}" status="DONE">`);
    expect(notification).toContain(`Task "Find public holidays" (${taskId}) is now DONE.`);
    expect(notification).toContain('You have been unsubscribed from this task.');

    // The model was called with the notification as the newest message.
    const lastPrompt = prompts[prompts.length - 1];
    expect(JSON.stringify(lastPrompt[lastPrompt.length - 1])).toContain('task-notification');

    expect(await agentReplies(threadId)).toEqual([
      'I will let you know when it is ready.',
      'The public holidays are in.',
    ]);
    // The user never sees the notification itself.
    const visible: Array<{ content: string }> = await dataSource.query(
      `SELECT content FROM thread_messages WHERE thread_id = $1`,
      [threadId],
    );
    expect(visible.some((row) => row.content.includes('task-notification'))).toBe(false);

    expect(await subscribedTaskIds(threadId)).toEqual([]);
  });

  it('notifies about a task in review and stays subscribed until it is done', async () => {
    const taskId = await createTask('Draft the report');
    const threadId = await threadSubscribedTo([taskId]);

    await setStatus(taskId, 'IN_PROGRESS');
    await setStatus(taskId, 'FOR_REVIEW');
    await waitForTurns(threadId, 2);

    expect(await notifications(threadId)).toEqual([
      expect.stringContaining('You are still subscribed'),
    ]);
    expect(await subscribedTaskIds(threadId)).toEqual([taskId]);

    await setStatus(taskId, 'DONE');
    await waitForTurns(threadId, 3);

    expect(await notifications(threadId)).toHaveLength(2);
    expect(await subscribedTaskIds(threadId)).toEqual([]);
  });

  it('follows several tasks at once and reports each one', async () => {
    const first = await createTask('First task');
    const second = await createTask('Second task');
    const threadId = await threadSubscribedTo([first, second]);

    expect(await subscribedTaskIds(threadId)).toEqual([first, second]);

    await setStatus(first, 'IN_PROGRESS');
    await setStatus(first, 'DONE');
    await waitForTurns(threadId, 2);

    expect(await subscribedTaskIds(threadId)).toEqual([second]);

    await setStatus(second, 'IN_PROGRESS');
    await setStatus(second, 'DONE');
    await waitForTurns(threadId, 3);

    const delivered = await notifications(threadId);
    expect(delivered).toHaveLength(2);
    expect(delivered[0]).toContain(first);
    expect(delivered[1]).toContain(second);
    expect(await subscribedTaskIds(threadId)).toEqual([]);
  });

  it('subscribes to a task that is already in review and reports its status', async () => {
    const taskId = await createTask('Already in review');
    await setStatus(taskId, 'IN_PROGRESS');
    await setStatus(taskId, 'FOR_REVIEW');

    const threadId = await threadSubscribedTo([taskId]);

    expect(await subscribedTaskIds(threadId)).toEqual([taskId]);
    const [toolResult]: Array<{ message: unknown }> = await dataSource.query(
      `SELECT message FROM thread_agent_messages WHERE thread_id = $1 AND role = 'tool'`,
      [threadId],
    );
    expect(JSON.stringify(toolResult.message)).toContain('is currently FOR_REVIEW');
    // Nothing changed since subscribing, so there is nothing to be told yet.
    expect(await notifications(threadId)).toEqual([]);
  });

  it('lets the agent unsubscribe, after which it is not woken up', async () => {
    const taskId = await createTask('No longer interesting');
    const threadId = await threadSubscribedTo([taskId]);

    script.push(
      { toolCalls: [{ toolName: 'unsubscribe_from_task', input: { taskId } }] },
      { text: 'Okay, I will stop watching it.' },
    );
    await sendMessage(threadId, 'never mind that task');
    await waitForTurns(threadId, 2);
    expect(await subscribedTaskIds(threadId)).toEqual([]);

    await setStatus(taskId, 'IN_PROGRESS');
    await setStatus(taskId, 'DONE');
    await new Promise((resolve) => setTimeout(resolve, 300));

    await waitForTurns(threadId, 2);
    expect(await notifications(threadId)).toEqual([]);
  });

  it('lets the agent stay silent about a notification', async () => {
    const taskId = await createTask('Quietly finished');
    const threadId = await threadSubscribedTo([taskId]);

    await setStatus(taskId, 'IN_PROGRESS');
    script.push({ toolCalls: [{ toolName: 'stay_silent', input: {} }] });
    await setStatus(taskId, 'DONE');
    await waitForTurns(threadId, 2);

    expect(await notifications(threadId)).toHaveLength(1);
    expect(await agentReplies(threadId)).toEqual(['I will let you know when it is ready.']);
  });

  it('tells the agent when the task does not exist', async () => {
    const threadId = await threadSubscribedTo(['not-a-task']);

    expect(await subscribedTaskIds(threadId)).toEqual([]);
    const [toolResult]: Array<{ message: unknown }> = await dataSource.query(
      `SELECT message FROM thread_agent_messages WHERE thread_id = $1 AND role = 'tool'`,
      [threadId],
    );
    expect(JSON.stringify(toolResult.message)).toContain('Task not-a-task not found.');
  });

  it('stops waiting for a task that is deleted', async () => {
    const taskId = await createTask('Deleted before it finished');
    const threadId = await threadSubscribedTo([taskId]);

    await request(httpServer)
      .delete(`/api/v1/tasks/tasks/${taskId}`)
      .set('Cookie', authCookies)
      .expect((response) => expect(response.status).toBeLessThan(300));

    for (let attempt = 0; attempt < 40; attempt++) {
      const rows: unknown[] = await dataSource.query(
        `SELECT 1 FROM thread_task_subscriptions WHERE thread_id = $1`,
        [threadId],
      );
      if (rows.length === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Subscription to a deleted task was not removed');
  });
});
