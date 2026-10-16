import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { jsonSchema, simulateReadableStream, tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AgentsService } from '../src/agents/agents.service';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { ThreadAgentService } from '../src/threads/agent/thread-agent.service';
import { ThreadTimersService } from '../src/threads/timers/thread-timers.service';
import { ThreadTimerSweeperService } from '../src/threads/timers/thread-timer-sweeper.service';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

type PromptMessage = { role: string; content: unknown };
type ToolCall = { toolName: string; input: Record<string, unknown> };
/**
 * What the model does on one call: say something, or call tools. With a
 * `gate`, the call does not answer until the gate resolves: a slow turn.
 */
type ModelStep = ({ text: string } | { toolCalls: ToolCall[] }) & { gate?: Promise<void> };

describe('Thread timers E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let userActorId: string;
  let agentActorId: string;
  let dataSource: DataSource;

  const prompts: PromptMessage[][] = [];
  /** The tool names offered on each model call, in the order of `prompts`. */
  const offeredTools: string[][] = [];
  /** An MCP tool the model must not reach for when asked the time. */
  const getAllTags = jest.fn(async () => [{ name: 'project:taico' }]);
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
      offeredTools.push((options.tools ?? []).map((t) => t.name));
      const call = ++callCount;
      const step: ModelStep = script.shift() ?? { text: `Reply ${call}` };
      if (step.gate) {
        await step.gate;
      }

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
      .send({ title: 'Timers thread' })
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
          input: { taskId, waitingFor: 'The user wants the public holidays for the offsite.' },
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
      .useValue({
        open: async () => ({
          tools: {
            tasks__get_all_tags: tool({
              description: 'List all available tags',
              inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {} }),
              execute: getAllTags,
            }),
          },
          close: async () => undefined,
        }),
      })
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

  type Timer = {
    id: string;
    kind: string;
    reason: string;
    periodSeconds: number | null;
    maxIterations: number;
    firedCount: number;
    nextFireAt: string;
  };

  const timers = async (threadId: string): Promise<Timer[]> => {
    const response = await request(httpServer)
      .get(`/api/v1/threads/${threadId}`)
      .set('Cookie', authCookies)
      .expect(200);
    return response.body.timers;
  };

  const firings = async (threadId: string): Promise<string[]> => {
    const rows: Array<{ message: { content: string } }> = await dataSource.query(
      `SELECT message FROM thread_agent_messages
        WHERE thread_id = $1 AND source = 'timer' AND kind = 'injection'
        ORDER BY created_at ASC`,
      [threadId],
    );
    return rows.map((row) => row.message.content);
  };

  const toolResults = async (threadId: string): Promise<string[]> => {
    const rows: Array<{ message: unknown }> = await dataSource.query(
      `SELECT message FROM thread_agent_messages WHERE thread_id = $1 AND role = 'tool'
        ORDER BY created_at ASC`,
      [threadId],
    );
    return rows.map((row) => JSON.stringify(row.message));
  };

  /** A thread whose agent called one tool while answering the user. */
  const threadWithToolCall = async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    const threadId = await createThread();
    script.push({ toolCalls: [{ toolName, input }] }, { text: 'Done.' });
    await sendMessage(threadId, 'please set it up');
    await waitForTurns(threadId, 1);
    return threadId;
  };

  const makeDue = async (timerId: string, ago = '1 second'): Promise<void> => {
    await dataSource.query(
      `UPDATE thread_timers SET next_fire_at = now() - $2::interval WHERE id = $1`,
      [timerId, ago],
    );
  };

  /** Many processes sweeping at the same moment. */
  const sweepConcurrently = async (): Promise<void> => {
    const sweeper = app.get(ThreadTimerSweeperService);
    const service = app.get(ThreadTimersService);
    await Promise.all([
      sweeper.sweep(),
      ...Array.from({ length: 4 }, () =>
        service.fireDue().then((threadIds) => {
          for (const threadId of threadIds) {
            app.get(ThreadAgentService).requestTurn(threadId);
          }
        }),
      ),
    ]);
  };

  it('fires a schedule once per period, once however many processes sweep, and says when it is the last', async () => {
    const threadId = await threadWithToolCall('schedule', {
      period: '5m',
      maxIterations: 2,
      reason: 'Check task #123 for new comments',
    });

    const [timer] = await timers(threadId);
    expect(timer).toMatchObject({
      kind: 'schedule',
      reason: 'Check task #123 for new comments',
      periodSeconds: 300,
      maxIterations: 2,
      firedCount: 0,
    });
    // The first firing is one period away, not now.
    const firstDelay = new Date(timer.nextFireAt).getTime() - Date.now();
    expect(firstDelay).toBeGreaterThan(290_000);
    expect(firstDelay).toBeLessThanOrEqual(300_000);

    const [result] = await toolResults(threadId);
    expect(result).toContain("I'll remind you every 5 minutes, up to 2 times.");
    expect(result).toContain(`You can cancel this schedule using ID ${timer.id}.`);
    expect(result).toContain('nextFireAt');

    await makeDue(timer.id);
    script.push({ toolCalls: [{ toolName: 'stay_silent', input: {} }] });
    await sweepConcurrently();
    await waitForTurns(threadId, 2);

    let delivered = await firings(threadId);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain(`<context source="schedule" id="${timer.id}" iteration="1 of 2">`);
    expect(delivered[0]).toContain('Check task #123 for new comments');
    expect(delivered[0]).not.toContain('final scheduled reminder');
    // The thread key is added when sent to the model.
    const lastPrompt = prompts[prompts.length - 1];
    expect(JSON.stringify(lastPrompt[lastPrompt.length - 1])).toMatch(
      /<context key=\\"[0-9a-f]{6}\\" source=\\"schedule\\"/,
    );
    expect((await timers(threadId))[0].firedCount).toBe(1);

    await makeDue(timer.id);
    script.push({ text: 'No new comments.' });
    await sweepConcurrently();
    await waitForTurns(threadId, 3);

    delivered = await firings(threadId);
    expect(delivered).toHaveLength(2);
    expect(delivered[1]).toContain('iteration="2 of 2"');
    expect(delivered[1]).toContain('This is the final scheduled reminder.');
    expect(await timers(threadId)).toEqual([]);
    expect(await dataSource.query(`SELECT 1 FROM thread_timers WHERE thread_id = $1`, [threadId])).toEqual([]);
  });

  it('delivers every firing that happens while the agent is still busy, in order', async () => {
    const threadId = await threadWithToolCall('schedule', {
      period: '5m',
      maxIterations: 3,
      reason: 'Watch the queue',
    });
    const [timer] = await timers(threadId);
    const service = app.get(ThreadTimersService);

    // The turn for the first firing hangs in the model call...
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    script.push({ text: 'Looking.', gate }, { text: 'Caught up.' });
    const callsBefore = callCount;
    await makeDue(timer.id);
    await sweepConcurrently();
    for (let attempt = 0; callCount === callsBefore; attempt++) {
      if (attempt > 100) throw new Error('The first firing never reached the model');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // ...while the schedule fires twice more. (The app's own sweeper may get
    // there first; either way each firing is queued once.)
    await makeDue(timer.id);
    await service.fireDue();
    await makeDue(timer.id);
    await service.fireDue();
    const queued: Array<{ iteration: number }> = await dataSource.query(
      `SELECT iteration FROM thread_timer_firings WHERE timer_id = $1 ORDER BY iteration`,
      [timer.id],
    );
    expect(queued.map((row) => row.iteration)).toEqual([2, 3]);

    // The busy turn finishes and the next one hears about both, oldest first.
    release();
    await waitForTurns(threadId, 3);

    const delivered = await firings(threadId);
    expect(delivered).toHaveLength(3);
    expect(delivered[0]).toContain('iteration="1 of 3"');
    expect(delivered[1]).toContain('iteration="2 of 3"');
    expect(delivered[2]).toContain('iteration="3 of 3"');
    expect(delivered[2]).toContain('This is the final scheduled reminder.');
    expect(await timers(threadId)).toEqual([]);
    expect(
      await dataSource.query(`SELECT 1 FROM thread_timer_firings WHERE timer_id = $1`, [timer.id]),
    ).toEqual([]);
  });

  it('drops firings not yet delivered when the timer is cancelled', async () => {
    const threadId = await threadWithToolCall('schedule', {
      period: '5m',
      maxIterations: 3,
      reason: 'Cancelled before delivery',
    });
    const [timer] = await timers(threadId);
    await makeDue(timer.id);
    await app.get(ThreadTimersService).fireDue();

    await request(httpServer)
      .delete(`/api/v1/threads/${threadId}/timers/${timer.id}`)
      .set('Cookie', authCookies)
      .expect(204);

    expect(
      await dataSource.query(`SELECT 1 FROM thread_timer_firings WHERE timer_id = $1`, [timer.id]),
    ).toEqual([]);
  });

  it('fires one catch-up after downtime and keeps the cadence', async () => {
    const threadId = await threadWithToolCall('schedule', {
      period: '5m',
      maxIterations: 10,
      reason: 'Poll the build',
    });
    const [timer] = await timers(threadId);

    // Down for an hour and a bit: twelve occurrences missed.
    await makeDue(timer.id, '62 minutes');
    const before: Array<{ next_fire_at: Date }> = await dataSource.query(
      `SELECT next_fire_at FROM thread_timers WHERE id = $1`,
      [timer.id],
    );
    script.push({ toolCalls: [{ toolName: 'stay_silent', input: {} }] });
    await sweepConcurrently();
    await waitForTurns(threadId, 2);

    expect(await firings(threadId)).toHaveLength(1);
    const [after] = await timers(threadId);
    expect(after.firedCount).toBe(1);
    const next = new Date(after.nextFireAt).getTime();
    expect(next).toBeGreaterThan(Date.now());
    expect(next - Date.now()).toBeLessThanOrEqual(300_000);
    // Still on the original 5-minute grid.
    expect((next - new Date(before[0].next_fire_at).getTime()) % 300_000).toBe(0);
  });

  it('reminds once, after a delay, and is gone afterwards', async () => {
    const threadId = await threadWithToolCall('remind', {
      in: '10m',
      reason: 'Try the deployment again',
    });
    const [timer] = await timers(threadId);
    expect(timer).toMatchObject({ kind: 'reminder', periodSeconds: null, maxIterations: 1 });

    const [result] = await toolResults(threadId);
    expect(result).toMatch(/It's now .*Z\. I'll remind you at .*Z, in 10 minutes\./);
    expect(result).toContain(`You can cancel this reminder using ID ${timer.id}.`);

    await makeDue(timer.id);
    script.push({ text: 'Deploying again.' });
    await sweepConcurrently();
    await waitForTurns(threadId, 2);

    expect(await firings(threadId)).toEqual([
      `<context source="reminder" id="${timer.id}">\nTry the deployment again\n</context>`,
    ]);
    expect(await timers(threadId)).toEqual([]);
  });

  it('reminds at a moment in a timezone', async () => {
    const year = new Date().getUTCFullYear() + 1;
    const threadId = await threadWithToolCall('remind', {
      at: `${year}-07-15T12:00:00`,
      timezone: 'Australia/Sydney',
      reason: 'Check in',
    });
    const [timer] = await timers(threadId);
    expect(timer.nextFireAt).toBe(`${year}-07-15T02:00:00.000Z`);
  });

  it.each([
    ['schedule', { period: '1h30m', maxIterations: 2, reason: 'x' }, 'Compound values'],
    ['schedule', { period: '5m', maxIterations: 0, reason: 'x' }, 'maxIterations must be a positive whole number'],
    ['schedule', { period: '5m', maxIterations: 11, reason: 'x' }, 'maxIterations can be at most 10'],
    ['remind', { in: '5m', at: '2030-01-01T00:00:00Z', reason: 'x' }, 'exactly one of'],
    ['remind', { at: '2020-01-01T00:00:00Z', reason: 'x' }, 'is in the past'],
    ['remind', { at: '2030-01-01T00:00:00', reason: 'x' }, 'has no offset'],
    ['remind', { at: '2030-01-01T00:00:00+24:00', reason: 'x' }, 'not a real UTC offset'],
    ['remind', { at: '2030-01-01T00:00:00+11:60', reason: 'x' }, 'not a real UTC offset'],
    ['remind', { at: '2030-01-01T00:00:00+05:00', timezone: 'Australia/Sydney', reason: 'x' }, 'does not match timezone'],
  ])('rejects bad %s input %j', async (toolName, input, error) => {
    const threadId = await threadWithToolCall(toolName, input);
    expect(await timers(threadId)).toEqual([]);
    const [result] = await toolResults(threadId);
    expect(result).toContain(error);
  });

  it('lists reminders, schedules and watched tasks together, and cancels idempotently', async () => {
    const taskId = await createTask('Watched task');
    const threadId = await createThread();
    script.push(
      {
        toolCalls: [
          { toolName: 'remind', input: { in: '1h', reason: 'Remind me' } },
          { toolName: 'schedule', input: { period: '30s', maxIterations: 3, reason: 'Poll' } },
          { toolName: 'subscribe_to_task', input: { taskId, waitingFor: 'The result' } },
        ],
      },
      { toolCalls: [{ toolName: 'list_reminders_schedules_and_watchers', input: {} }] },
      { text: 'All set.' },
    );
    await sendMessage(threadId, 'set things up');
    await waitForTurns(threadId, 1);

    const results = await toolResults(threadId);
    const listing = results[results.length - 1];
    expect(listing).toContain('Remind me');
    expect(listing).toContain('Poll');
    expect(listing).toContain('Watched task');
    expect(listing).toContain('"periodSeconds":30');

    const [first, second] = await timers(threadId);
    for (const timer of [first, second, first]) {
      await request(httpServer)
        .delete(`/api/v1/threads/${threadId}/timers/${timer.id}`)
        .set('Cookie', authCookies)
        .expect(204);
    }
    expect(await timers(threadId)).toEqual([]);

    for (let i = 0; i < 2; i++) {
      await request(httpServer)
        .delete(`/api/v1/threads/${threadId}/task-subscriptions/${taskId}`)
        .set('Cookie', authCookies)
        .expect(204);
    }
    expect(await subscribedTaskIds(threadId)).toEqual([]);

    // The agent cancelling something already gone is not an error either.
    script.push(
      { toolCalls: [{ toolName: 'cancel_schedule', input: { id: second.id } }] },
      { text: 'Already gone.' },
    );
    await sendMessage(threadId, 'cancel the poll');
    await waitForTurns(threadId, 2);
    const after = await toolResults(threadId);
    expect(after[after.length - 1]).toContain('Nothing to do.');
  });

  it('does not fire timers of a deleted thread', async () => {
    const threadId = await threadWithToolCall('remind', { in: '5m', reason: 'Never' });
    const [timer] = await timers(threadId);
    await request(httpServer)
      .delete(`/api/v1/threads/${threadId}`)
      .set('Cookie', authCookies)
      .expect(204);

    await makeDue(timer.id);
    expect(await app.get(ThreadTimersService).fireDue()).not.toContain(threadId);
  });

  describe('get_time', () => {
    const postMessage = (threadId: string, body: Record<string, unknown>) =>
      request(httpServer).post(`/api/v1/threads/${threadId}/messages`).set('Cookie', authCookies).send(body);

    const storedTimezones = async (threadId: string): Promise<Array<string | null>> => {
      const rows: Array<{ timezone: string | null }> = await dataSource.query(
        `SELECT timezone FROM thread_messages WHERE thread_id = $1 AND created_by_actor_id = $2
          ORDER BY created_at ASC`,
        [threadId, userActorId],
      );
      return rows.map((row) => row.timezone);
    };

    it('rejects a timezone that is not an IANA name', async () => {
      const threadId = await createThread();
      await postMessage(threadId, { content: 'hi', timezone: '+10:00' }).expect(400);
      await postMessage(threadId, { content: 'hi', timezone: 'Mars/Olympus_Mons' }).expect(400);
      expect(await storedTimezones(threadId)).toEqual([]);
    });

    it("returns the time in the latest user message's timezone, and keeps it out of the conversation", async () => {
      const threadId = await createThread();
      script.push({ toolCalls: [{ toolName: 'get_time', input: {} }] }, { text: 'It is late in Sydney.' });
      await postMessage(threadId, { content: 'remind me tomorrow at 5pm', timezone: 'Australia/Sydney' }).expect(201);
      await waitForTurns(threadId, 1);

      expect(await storedTimezones(threadId)).toEqual(['Australia/Sydney']);
      const [result] = await toolResults(threadId);
      expect(result).toContain('"userTimezone":"Australia/Sydney"');
      expect(result).toMatch(/"now":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+1[01]:00"/);

      // The model only saw the timezone through the tool, not in the user's message.
      const firstPrompt = JSON.stringify(prompts[prompts.length - 2]);
      expect(firstPrompt).toContain('remind me tomorrow at 5pm');
      expect(firstPrompt).not.toContain('Australia/Sydney');
    });

    // A fresh thread on the ChatGPT plan answered "what's the time?" by calling
    // tasks__get_all_tags 40 times. These pin down what Taico controls: the
    // tool is offered and named on the first turn, it runs only itself, and a
    // repeated call cannot loop until the step limit.
    it('offers get_time on the first turn of a new thread and tells the model to use it', async () => {
      const threadId = await createThread();
      const before = offeredTools.length;
      getAllTags.mockClear();
      script.push({ toolCalls: [{ toolName: 'get_time', input: {} }] }, { text: 'It is 5pm.' });
      await sendMessage(threadId, "what's the time?");
      await waitForTurns(threadId, 1);

      const [firstCall] = offeredTools.slice(before);
      expect(firstCall).toEqual(expect.arrayContaining(['get_time', 'tasks__get_all_tags']));
      expect(JSON.stringify(prompts[before])).toContain('call get_time. Never guess it.');

      const [result] = await toolResults(threadId);
      expect(result).toContain('"now":');
      expect(getAllTags).not.toHaveBeenCalled();
      expect(await agentReplies(threadId)).toEqual(['It is 5pm.']);
    });

    it('stops a turn that keeps making the same tool call, and says so', async () => {
      const threadId = await createThread();
      const before = prompts.length;
      getAllTags.mockClear();
      const sameCall = { toolCalls: [{ toolName: 'tasks__get_all_tags', input: {} }] };
      script.push(sameCall, sameCall, sameCall);
      await sendMessage(threadId, "what's the time?");
      await waitForTurns(threadId, 1);

      expect(prompts.length - before).toBe(3);
      expect(getAllTags).toHaveBeenCalledTimes(3);
      const [reply] = await agentReplies(threadId);
      expect(reply).toContain('`tasks__get_all_tags` 3 times in a row');
    });

    it('reports a missing timezone instead of guessing', async () => {
      const threadId = await createThread();
      script.push({ toolCalls: [{ toolName: 'get_time', input: {} }] }, { text: 'Which timezone are you in?' });
      await sendMessage(threadId, 'remind me tomorrow at 5pm');
      await waitForTurns(threadId, 1);

      expect(await storedTimezones(threadId)).toEqual([null]);
      const [result] = await toolResults(threadId);
      expect(result).toContain('"userTimezone":null');
      expect(result).toMatch(/"now":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    });
  });
});
