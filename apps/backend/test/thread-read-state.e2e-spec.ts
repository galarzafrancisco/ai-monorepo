import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThreadWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ThreadMessageEntity } from '../src/threads/thread-message.entity';
import { MessageCreatedEvent } from '../src/threads/events/threads.events';
import { createSnapshotSync } from '../../ui/src/features/threads/snapshotSync';
import {
  ensureAgentActor,
  ensureTestUser,
  getAuthCookies,
} from './helpers/auth.helper';

describe('Thread read state E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let userActorId: string;
  let agentActorId: string;
  let dataSource: DataSource;
  const sockets: Socket[] = [];

  const createThread = async (): Promise<string> => {
    const response = await request(httpServer)
      .post('/api/v1/threads')
      .set('Cookie', authCookies)
      .send({ title: 'Read state thread' })
      .expect(201);
    return response.body.id;
  };

  /**
   * Writes a message the way the threads agent does: straight to the table,
   * then the domain event. Going through the HTTP endpoint would start an
   * agent turn, which needs a model.
   */
  const postMessage = async (threadId: string, actorId: string): Promise<void> => {
    const repository = dataSource.getRepository(ThreadMessageEntity);
    const saved = await repository.save(
      repository.create({ threadId, content: 'hello', createdByActorId: actorId }),
    );
    const message = await repository.findOneOrFail({
      where: { id: saved.id },
      relations: ['createdByActor'],
    });
    app
      .get(EventEmitter2)
      .emit(MessageCreatedEvent.INTERNAL, new MessageCreatedEvent({ id: actorId }, message));
  };

  const unreadCount = async (threadId: string): Promise<number> => {
    const response = await request(httpServer)
      .get('/api/v1/threads?limit=200')
      .set('Cookie', authCookies)
      .expect(200);
    const item = response.body.items.find((t: { id: string }) => t.id === threadId);
    expect(item).toBeDefined();
    return item.unreadCount;
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

  const nextEvent = <T>(socket: Socket, name: string): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No ${name} event`)), 5000);
      socket.once(name, (event: T) => {
        clearTimeout(timer);
        resolve(event);
      });
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    agentActorId = await ensureAgentActor(app, 'read-state-agent', 'Read State Agent');
    authCookies = await getAuthCookies(httpServer);
  }, 30000);

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await app.close();
  });

  it('lists messages newest first, so the first page is always the latest ones', async () => {
    const threadId = await createThread();
    const repository = dataSource.getRepository(ThreadMessageEntity);
    const start = Date.now() - 60_000;
    for (let i = 1; i <= 5; i++) {
      await repository.save(
        repository.create({
          threadId,
          content: `message ${i}`,
          createdByActorId: userActorId,
          createdAt: new Date(start + i * 1000),
        }),
      );
    }

    const listPage = async (page: number): Promise<{ total: number; contents: string[] }> => {
      const response = await request(httpServer)
        .get(`/api/v1/threads/${threadId}/messages?page=${page}&limit=2`)
        .set('Cookie', authCookies)
        .expect(200);
      return {
        total: response.body.total,
        contents: response.body.items.map((m: { content: string }) => m.content),
      };
    };

    expect(await listPage(1)).toEqual({ total: 5, contents: ['message 5', 'message 4'] });
    expect(await listPage(2)).toEqual({ total: 5, contents: ['message 3', 'message 2'] });
    expect(await listPage(3)).toEqual({ total: 5, contents: ['message 1'] });
  });

  it('reports no unread messages for an empty thread', async () => {
    const threadId = await createThread();
    expect(await unreadCount(threadId)).toBe(0);
  });

  it("counts other actors' messages as unread, never the caller's own", async () => {
    const threadId = await createThread();

    await postMessage(threadId, userActorId);
    expect(await unreadCount(threadId)).toBe(0);

    await postMessage(threadId, agentActorId);
    await postMessage(threadId, agentActorId);
    expect(await unreadCount(threadId)).toBe(2);
  });

  it('clears the count when the thread is marked read, and counts only later messages', async () => {
    const threadId = await createThread();
    await postMessage(threadId, agentActorId);
    expect(await unreadCount(threadId)).toBe(1);

    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/read`)
      .set('Cookie', authCookies)
      .expect(204);
    expect(await unreadCount(threadId)).toBe(0);

    // Marking read twice is fine.
    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/read`)
      .set('Cookie', authCookies)
      .expect(204);

    await postMessage(threadId, agentActorId);
    expect(await unreadCount(threadId)).toBe(1);
  });

  it('keeps read positions separate per thread', async () => {
    const readThreadId = await createThread();
    const unreadThreadId = await createThread();
    await postMessage(readThreadId, agentActorId);
    await postMessage(unreadThreadId, agentActorId);

    await request(httpServer)
      .post(`/api/v1/threads/${readThreadId}/read`)
      .set('Cookie', authCookies)
      .expect(204);

    expect(await unreadCount(readThreadId)).toBe(0);
    expect(await unreadCount(unreadThreadId)).toBe(1);
  });

  it('returns 404 when marking a missing thread as read', async () => {
    await request(httpServer)
      .post('/api/v1/threads/00000000-0000-4000-8000-000000000000/read')
      .set('Cookie', authCookies)
      .expect(404);
  });

  it('tells the thread list when a message is posted', async () => {
    const threadId = await createThread();
    const tab = await openListSocket();

    const activity = nextEvent<{ payload: { threadId: string; createdByActorId: string } }>(
      tab,
      ThreadWireEvents.THREAD_ACTIVITY,
    );
    await postMessage(threadId, agentActorId);

    expect((await activity).payload).toMatchObject({
      threadId,
      createdByActorId: agentActorId,
    });
  });

  it("tells the user's other tabs when a thread is marked read", async () => {
    const threadId = await createThread();
    await postMessage(threadId, agentActorId);
    const tabA = await openListSocket();
    const tabB = await openListSocket();

    const readOnA = nextEvent<{ payload: { threadId: string } }>(tabA, ThreadWireEvents.THREAD_READ);
    const readOnB = nextEvent<{ payload: { threadId: string } }>(tabB, ThreadWireEvents.THREAD_READ);

    // Marked read from somewhere else: a third tab, or another device.
    await request(httpServer)
      .post(`/api/v1/threads/${threadId}/read`)
      .set('Cookie', authCookies)
      .expect(204);

    expect((await readOnA).payload.threadId).toBe(threadId);
    expect((await readOnB).payload.threadId).toBe(threadId);
  });

  /**
   * The thread list in the UI, without React: a list of unread counts kept up
   * to date by the same sync helper and the same rules as `useThreads`.
   */
  describe('thread list kept in sync by the UI', () => {
    type ListItem = { id: string; unreadCount: number };

    const openList = () => {
      let items: ListItem[] = [];
      /** Holds back the response of the next fetch until called. */
      let holdResponse: Promise<void> | null = null;

      const sync = createSnapshotSync<ListItem[]>(
        async () => {
          const held = holdResponse;
          holdResponse = null;
          const response = await request(httpServer)
            .get('/api/v1/threads?limit=200')
            .set('Cookie', authCookies)
            .expect(200);
          await held;
          return response.body.items;
        },
        (snapshot) => {
          items = snapshot;
        },
      );

      const onActivity = (event: { payload: { threadId: string } }) => {
        sync.noteChange();
        items = items.map((item) =>
          item.id === event.payload.threadId
            ? { ...item, unreadCount: item.unreadCount + 1 }
            : item,
        );
      };

      return {
        sync,
        onActivity,
        unread: (threadId: string) => items.find((item) => item.id === threadId)?.unreadCount,
        holdNextResponse: (): (() => void) => {
          let release!: () => void;
          holdResponse = new Promise<void>((resolve) => {
            release = resolve;
          });
          return release;
        },
      };
    };

    it('catches up on a message posted between the first fetch and the subscription', async () => {
      const threadId = await createThread();
      const list = openList();

      await list.sync.refresh();
      expect(list.unread(threadId)).toBe(0);

      // No socket of this list is in the room yet, so no event reaches it.
      await postMessage(threadId, agentActorId);

      const tab = await openListSocket();
      tab.on(ThreadWireEvents.THREAD_ACTIVITY, list.onActivity);
      // What the UI does when the subscription is acknowledged.
      await list.sync.refresh();

      expect(list.unread(threadId)).toBe(1);
    });

    it('does not let a late response undo a newer message', async () => {
      const threadId = await createThread();
      const list = openList();
      const tab = await openListSocket();
      tab.on(ThreadWireEvents.THREAD_ACTIVITY, list.onActivity);
      await list.sync.refresh();

      // This response is built before the message exists and arrives after its event.
      const release = list.holdNextResponse();
      const refreshed = list.sync.refresh();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const activity = nextEvent(tab, ThreadWireEvents.THREAD_ACTIVITY);
      await postMessage(threadId, agentActorId);
      await activity;
      expect(list.unread(threadId)).toBe(1);

      release();
      await refreshed;

      expect(list.unread(threadId)).toBe(1);
    });

    it('fetches once more when a refresh is asked for during a fetch', async () => {
      const threadId = await createThread();
      const list = openList();

      // The page-load fetch is still running when the subscription is acknowledged.
      const release = list.holdNextResponse();
      const firstLoad = list.sync.refresh();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await postMessage(threadId, agentActorId);
      const afterSubscribe = list.sync.refresh();

      release();
      await Promise.all([firstLoad, afterSubscribe]);

      expect(list.unread(threadId)).toBe(1);
    });
  });
});
