import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { ThreadActivityWireEvent, ThreadWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AgentsService } from '../src/agents/agents.service';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { ThreadAgentLogService } from '../src/threads/agent/thread-agent-log.service';
import {
  ThreadAgentMessageKind,
  ThreadAgentMessageRole,
} from '../src/threads/agent/thread-agent.enums';
import { ThreadMessageWriterService } from '../src/threads/thread-message-writer.service';
import { ThreadLastActivity1761500000000 } from '../src/migrations/1761500000000-ThreadLastActivity';
import {
  applyThreadActivity,
  OrderedThread,
} from '../../ui/src/features/threads/threadListOrder';
import { ensureAgentActor, ensureTestUser, getAuthCookies } from './helpers/auth.helper';

type ToolCall = { toolName: string; input: Record<string, unknown> };
/** What the model does on one call: say something, or call tools. */
type ModelStep = { text: string } | { toolCalls: ToolCall[] };
type ListItem = OrderedThread & { title: string };

describe('Thread ordering E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let userActorId: string;
  let agentActorId: string;
  let otherActorId: string;
  let dataSource: DataSource;
  const sockets: Socket[] = [];

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
    doStream: async () => {
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

  const staySilent: ModelStep = { toolCalls: [{ toolName: 'stay_silent', input: {} }] };

  const createThread = async (title = 'Ordering thread'): Promise<string> => {
    const response = await request(httpServer)
      .post('/api/v1/threads')
      .set('Cookie', authCookies)
      .send({ title })
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

  const sendMessage = async (threadId: string, content: string): Promise<void> => {
    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/messages`)
      .set('Cookie', authCookies)
      .send({ content })
      .expect(201);
  };

  const listThreads = async (query = 'limit=200'): Promise<ListItem[]> => {
    const response = await request(httpServer)
      .get(`/api/v1/threads?${query}`)
      .set('Cookie', authCookies)
      .expect(200);
    return response.body.items;
  };

  /** The given threads in the order the list shows them. */
  const orderOf = async (threadIds: string[]): Promise<string[]> =>
    (await listThreads()).map((thread) => thread.id).filter((id) => threadIds.includes(id));

  /** Read as text so the comparison keeps Postgres' microseconds. */
  const lastActivityAt = async (threadId: string): Promise<string> => {
    const rows: Array<{ at: string }> = await dataSource.query(
      `SELECT last_activity_at::text AS at FROM threads WHERE id = $1`,
      [threadId],
    );
    return rows[0].at;
  };

  const messageTimes = async (threadId: string, actorId: string): Promise<string[]> => {
    const rows: Array<{ at: string }> = await dataSource.query(
      `SELECT created_at::text AS at FROM thread_messages
        WHERE thread_id = $1 AND created_by_actor_id = $2 ORDER BY created_at ASC`,
      [threadId, actorId],
    );
    return rows.map((row) => row.at);
  };

  const agentLogCount = async (threadId: string, where = 'TRUE'): Promise<number> => {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM thread_agent_messages WHERE thread_id = $1 AND ${where}`,
      [threadId],
    );
    return Number(rows[0].count);
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

  /** A browser tab on the thread list: connected and subscribed. */
  const openListSocket = async (): Promise<Socket> => {
    const { port } = (httpServer as unknown as { address(): AddressInfo }).address();
    const socket = io(`http://127.0.0.1:${port}/threads`, {
      transports: ['websocket'],
      extraHeaders: { cookie: authCookies },
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const ack = await socket.emitWithAck('threads.subscribe', {});
    expect(ack.ok).toBe(true);
    return socket;
  };

  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

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
    await app.listen(0, '127.0.0.1');

    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);
    userActorId = await ensureTestUser(app);
    otherActorId = await ensureAgentActor(app, 'ordering-agent', 'Ordering Agent');
    authCookies = await getAuthCookies(httpServer);
    agentActorId = (await app.get(AgentsService).getAgentBySlug({ slug: 'taico' })).actorId;
  }, 30000);

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await app.close();
  });

  afterEach(() => {
    script.length = 0;
  });

  it('lists a new thread first, at its creation time', async () => {
    const older = await createThread();
    await tick();
    const newer = await createThread();

    expect(await orderOf([older, newer])).toEqual([newer, older]);

    const rows: Array<{ same: boolean }> = await dataSource.query(
      `SELECT last_activity_at = created_at AS same FROM threads WHERE id = $1`,
      [newer],
    );
    expect(rows[0].same).toBe(true);
  });

  it('moves a thread to the top when a person posts, even if the agent only calls tools', async () => {
    const older = await createThread();
    await tick();
    const newer = await createThread();
    const created = await lastActivityAt(older);

    script.push(staySilent);
    await sendMessage(older, 'no need to answer');
    await waitForTurns(older, 1);

    expect(await orderOf([older, newer])).toEqual([older, newer]);

    // The turn wrote to the agent log (the message, the tool call, its result)
    // and showed nothing: the thread's time is the person's message, exactly.
    expect(await agentLogCount(older, `role IN ('assistant', 'tool')`)).toBeGreaterThanOrEqual(2);
    expect(await messageTimes(older, agentActorId)).toEqual([]);
    const [posted] = await messageTimes(older, userActorId);
    expect(await lastActivityAt(older)).toBe(posted);
    expect(posted > created).toBe(true);
  });

  it('moves a thread to the top when the agent replies with a visible message', async () => {
    const threadId = await createThread();
    await tick();
    const newer = await createThread();

    script.push({ text: 'Here you go.' });
    await sendMessage(threadId, 'hello');
    await waitForTurns(threadId, 1);

    const [posted] = await messageTimes(threadId, userActorId);
    const [replied] = await messageTimes(threadId, agentActorId);
    expect(replied > posted).toBe(true);
    expect(await lastActivityAt(threadId)).toBe(replied);
    expect(await orderOf([threadId, newer])).toEqual([threadId, newer]);

    const item = (await listThreads()).find((thread) => thread.id === threadId)!;
    expect(new Date(item.lastActivityAt).getTime()).toBe(new Date(replied).getTime());
  });

  it('does not move a thread when the agent is told about a task and stays silent', async () => {
    const threadId = await createThread();
    const taskId = await createTask('Find the public holidays');
    script.push(
      { toolCalls: [{ toolName: 'subscribe_to_task', input: { taskId, waitingFor: 'The holidays.' } }] },
      { text: 'I will let you know when it is ready.' },
    );
    await sendMessage(threadId, 'find the public holidays');
    await waitForTurns(threadId, 1);
    await tick();
    const newer = await createThread();
    const before = await lastActivityAt(threadId);

    script.push(staySilent);
    await request(httpServer)
      .patch(`/api/v1/tasks/tasks/${taskId}/status`)
      .set('Cookie', authCookies)
      .send({ status: 'DONE', comment: 'Finished' })
      .expect(200);
    await waitForTurns(threadId, 2);

    expect(
      await agentLogCount(threadId, `source = 'subscription:task' AND kind = 'injection'`),
    ).toBe(1);
    expect(await lastActivityAt(threadId)).toBe(before);
    expect(await orderOf([threadId, newer])).toEqual([newer, threadId]);
  });

  it('moves a thread when the agent tells people about a task it was notified of', async () => {
    const threadId = await createThread();
    const taskId = await createTask('Book the venue');
    script.push(
      { toolCalls: [{ toolName: 'subscribe_to_task', input: { taskId, waitingFor: 'The venue.' } }] },
      { text: 'I will let you know when it is ready.' },
    );
    await sendMessage(threadId, 'book the venue');
    await waitForTurns(threadId, 1);
    await tick();
    const newer = await createThread();

    script.push({ text: 'The venue is booked.' });
    await request(httpServer)
      .patch(`/api/v1/tasks/tasks/${taskId}/status`)
      .set('Cookie', authCookies)
      .send({ status: 'DONE', comment: 'Finished' })
      .expect(200);
    await waitForTurns(threadId, 2);

    const replies = await messageTimes(threadId, agentActorId);
    expect(replies).toHaveLength(2);
    expect(await lastActivityAt(threadId)).toBe(replies[1]);
    expect(await orderOf([threadId, newer])).toEqual([threadId, newer]);
  });

  it('does not move a thread for agent-log writes, the thread key, a rename or a tag', async () => {
    const threadId = await createThread();
    await tick();
    const newer = await createThread();
    const before = await lastActivityAt(threadId);
    const agentLog = app.get(ThreadAgentLogService);

    await agentLog.append(threadId, [
      {
        role: ThreadAgentMessageRole.USER,
        kind: ThreadAgentMessageKind.INJECTION,
        source: 'hook:test',
        message: { role: 'user', content: 'context only the model reads' },
      },
      {
        role: ThreadAgentMessageRole.ASSISTANT,
        kind: ThreadAgentMessageKind.SUMMARY,
        source: 'compaction',
        message: { role: 'assistant', content: 'summary of earlier messages' },
      },
    ]);
    await agentLog.getOrCreateThreadSecret(threadId);
    await request(httpServer)
      .patch(`/api/v1/threads/${threadId}`)
      .set('Cookie', authCookies)
      .send({ title: 'Renamed' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/tags`)
      .set('Cookie', authCookies)
      .send({ name: 'ordering-test' })
      .expect(201);

    expect(await agentLogCount(threadId)).toBe(2);
    expect(await lastActivityAt(threadId)).toBe(before);
    expect(await orderOf([threadId, newer])).toEqual([newer, threadId]);
  });

  it('keeps the newest message time when an older message is saved after it', async () => {
    const threadId = await createThread();
    // As if a writer whose transaction started later had already committed.
    await dataSource.query(
      `UPDATE threads SET last_activity_at = now() + interval '1 hour' WHERE id = $1`,
      [threadId],
    );
    const ahead = await lastActivityAt(threadId);

    await app.get(ThreadMessageWriterService).write({
      threadId,
      content: 'committed late',
      createdByActorId: otherActorId,
    });

    expect(await lastActivityAt(threadId)).toBe(ahead);
  });

  it('saves nothing when the message cannot be written', async () => {
    const threadId = await createThread();
    const before = await lastActivityAt(threadId);

    await expect(
      app.get(ThreadMessageWriterService).write({
        threadId,
        content: 'from nobody',
        createdByActorId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow();

    expect(await lastActivityAt(threadId)).toBe(before);
  });

  it('counts every message when several are written to one thread at once', async () => {
    const threadId = await createThread();
    const writer = app.get(ThreadMessageWriterService);

    const written = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        writer.write({ threadId, content: `message ${i}`, createdByActorId: otherActorId }),
      ),
    );

    const times = await messageTimes(threadId, otherActorId);
    expect(times).toHaveLength(written.length);
    expect(await lastActivityAt(threadId)).toBe(times[times.length - 1]);
  });

  it('tells the list when a message was posted, for the current user and for others', async () => {
    const threadId = await createThread();
    const socket = await openListSocket();
    const events: ThreadActivityWireEvent[] = [];
    socket.on(ThreadWireEvents.THREAD_ACTIVITY, (event: ThreadActivityWireEvent) => {
      if (event.payload.threadId === threadId) events.push(event);
    });

    script.push({ text: 'Hello back.' });
    await sendMessage(threadId, 'hello');
    await waitForTurns(threadId, 1);
    for (let attempt = 0; attempt < 100 && events.length < 2; attempt++) await tick();

    expect(events.map((event) => event.payload.createdByActorId)).toEqual([
      userActorId,
      agentActorId,
    ]);
    const item = (await listThreads()).find((thread) => thread.id === threadId)!;
    expect(events[1].payload.createdAt).toBe(item.lastActivityAt);
  });

  describe('the list in the browser', () => {
    const thread = (id: string, lastActivityAt: string, unreadCount = 0): OrderedThread => ({
      id,
      lastActivityAt,
      unreadCount,
    });
    const list = [
      thread('c', '2026-01-03T00:00:00.000Z'),
      thread('b', '2026-01-02T00:00:00.000Z', 1),
      thread('a', '2026-01-01T00:00:00.000Z'),
    ];
    const at = '2026-01-04T00:00:00.000Z';
    const viewer = { actorId: 'me', viewingThreadId: null };

    it('moves the thread up and counts the message as unread when someone else posts', () => {
      const next = applyThreadActivity(
        list,
        { threadId: 'a', createdByActorId: 'someone', createdAt: at },
        viewer,
      );
      expect(next).toEqual([thread('a', at, 1), list[0], list[1]]);
    });

    it('moves the thread up without an unread count when the current user posts', () => {
      const next = applyThreadActivity(
        list,
        { threadId: 'b', createdByActorId: 'me', createdAt: at },
        viewer,
      );
      expect(next).toEqual([thread('b', at, 1), list[0], list[2]]);
    });

    it('moves the open thread up without an unread count', () => {
      const next = applyThreadActivity(
        list,
        { threadId: 'a', createdByActorId: 'someone', createdAt: at },
        { actorId: 'me', viewingThreadId: 'a' },
      );
      expect(next).toEqual([thread('a', at, 0), list[0], list[1]]);
    });

    it('counts a late event as unread without moving the thread back', () => {
      const next = applyThreadActivity(
        list,
        { threadId: 'c', createdByActorId: 'someone', createdAt: '2025-12-31T00:00:00.000Z' },
        viewer,
      );
      expect(next).toEqual([thread('c', list[0].lastActivityAt, 1), list[1], list[2]]);
    });

    it('breaks a tie by id, highest first', () => {
      const next = applyThreadActivity(
        list,
        { threadId: 'a', createdByActorId: 'me', createdAt: list[0].lastActivityAt },
        viewer,
      );
      expect(next!.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    });

    it('asks for a fresh list when the thread is not loaded', () => {
      expect(
        applyThreadActivity(
          list,
          { threadId: 'z', createdByActorId: 'someone', createdAt: at },
          viewer,
        ),
      ).toBeNull();
    });

    it('ends up in the order the server lists after live messages', async () => {
      const ids = [await createThread(), await createThread(), await createThread()];
      const socket = await openListSocket();
      let local: ListItem[] = (await listThreads()).filter((item) => ids.includes(item.id));
      let received = 0;
      socket.on(ThreadWireEvents.THREAD_ACTIVITY, (event: ThreadActivityWireEvent) => {
        received += 1;
        local =
          applyThreadActivity(local, event.payload, {
            actorId: userActorId,
            viewingThreadId: ids[0],
          }) ?? local;
      });

      // The oldest thread: the user is looking at it and both messages are shown there.
      script.push({ text: 'Answer.' });
      await sendMessage(ids[0], 'question');
      await waitForTurns(ids[0], 1);
      for (let attempt = 0; attempt < 100 && received < 2; attempt++) await tick();

      const server = (await listThreads()).filter((item) => ids.includes(item.id));
      expect(server.map((item) => item.id)).toEqual([ids[0], ids[2], ids[1]]);
      expect(local.map((item) => item.id)).toEqual(server.map((item) => item.id));
      expect(local[0].lastActivityAt).toBe(server[0].lastActivityAt);
      // The agent's reply is unread on the server until the open chat marks it read.
      expect(local[0].unreadCount).toBe(0);
      expect(server[0].unreadCount).toBe(1);
    });
  });

  // These two rewrite `last_activity_at` on many threads, so they run last.
  it('pages through threads with the same time without repeating or skipping any', async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(await createThread());
    await dataSource.query(
      `UPDATE threads SET last_activity_at = now() + interval '1 day' WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    const paged: string[] = [];
    for (let page = 1; page <= 3; page++) {
      paged.push(...(await listThreads(`limit=2&page=${page}`)).map((item) => item.id));
    }

    const sorted: Array<{ id: string }> = await dataSource.query(
      `SELECT id FROM threads WHERE id = ANY($1::uuid[]) ORDER BY id DESC`,
      [ids],
    );
    expect(paged.slice(0, 5)).toEqual(sorted.map((row) => row.id));
  });

  it('gives threads that predate the column the time of their newest message', async () => {
    const withMessages = await createThread();
    const empty = await createThread();
    await app.get(ThreadMessageWriterService).write({
      threadId: withMessages,
      content: 'first',
      createdByActorId: otherActorId,
    });
    await tick();
    await app.get(ThreadMessageWriterService).write({
      threadId: withMessages,
      content: 'second',
      createdByActorId: otherActorId,
    });
    // An agent-log row newer than every visible message must not count.
    await tick();
    await app.get(ThreadAgentLogService).append(withMessages, [
      {
        role: ThreadAgentMessageRole.ASSISTANT,
        source: 'model',
        message: { role: 'assistant', content: 'internal' },
      },
    ]);

    const migration = new ThreadLastActivity1761500000000();
    const queryRunner = dataSource.createQueryRunner();
    try {
      await migration.down(queryRunner);
      await migration.up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    const times = await messageTimes(withMessages, otherActorId);
    expect(await lastActivityAt(withMessages)).toBe(times[1]);
    const rows: Array<{ same: boolean }> = await dataSource.query(
      `SELECT last_activity_at = created_at AS same FROM threads WHERE id = $1`,
      [empty],
    );
    expect(rows[0].same).toBe(true);
    expect(await orderOf([withMessages, empty])).toEqual([withMessages, empty]);
  });
});
