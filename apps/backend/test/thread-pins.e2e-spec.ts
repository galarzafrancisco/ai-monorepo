import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { ThreadPinnedWireEvent, ThreadWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ThreadPinEntity } from '../src/threads/pins/thread-pin.entity';
import {
  applyThreadPinned,
  compareThreads,
  OrderedThread,
} from '../../ui/src/features/threads/threadListOrder';
import { ensureAgentActor, ensureTestUser, getAuthCookies } from './helpers/auth.helper';

type ListItem = OrderedThread & { id: string; pinned: boolean };

describe('Thread pins E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let agentActorId: string;
  let dataSource: DataSource;
  const sockets: Socket[] = [];

  const createThread = async (): Promise<string> => {
    const response = await request(httpServer)
      .post('/api/v1/threads')
      .set('Cookie', authCookies)
      .send({ title: 'Pinned thread' })
      .expect(201);
    return response.body.id;
  };

  const listThreads = async (query = 'limit=200'): Promise<ListItem[]> => {
    const response = await request(httpServer)
      .get(`/api/v1/threads?${query}`)
      .set('Cookie', authCookies)
      .expect(200);
    return response.body.items;
  };

  const pin = (threadId: string, expected = 204) =>
    request(httpServer)
      .put(`/api/v1/threads/${threadId}/pin`)
      .set('Cookie', authCookies)
      .expect(expected);

  const unpin = (threadId: string, expected = 204) =>
    request(httpServer)
      .delete(`/api/v1/threads/${threadId}/pin`)
      .set('Cookie', authCookies)
      .expect(expected);

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
    await ensureTestUser(app);
    agentActorId = await ensureAgentActor(app, 'pins-agent', 'Pins Agent');
    authCookies = await getAuthCookies(httpServer);
  }, 30000);

  afterEach(async () => {
    // Pins from one test must not reorder the list for the next.
    await dataSource.getRepository(ThreadPinEntity).clear();
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await app.close();
  });

  it('lists threads as not pinned by default', async () => {
    const threadId = await createThread();
    const item = (await listThreads()).find((t) => t.id === threadId);
    expect(item?.pinned).toBe(false);
  });

  it('lists a pinned thread first, ahead of newer threads, until it is unpinned', async () => {
    const older = await createThread();
    const newer = await createThread();

    await pin(older);
    let items = await listThreads();
    expect(items[0]).toMatchObject({ id: older, pinned: true });
    expect(items[1].id).toBe(newer);

    // Pinning twice is fine.
    await pin(older);

    await unpin(older);
    items = await listThreads();
    expect(items[0]).toMatchObject({ id: newer, pinned: false });
    expect(items.find((t) => t.id === older)?.pinned).toBe(false);

    // Unpinning twice is fine.
    await unpin(older);
  });

  it('orders pinned threads among themselves by latest activity, on the first page', async () => {
    const first = await createThread();
    const second = await createThread();
    await createThread();

    await pin(first);
    await pin(second);

    const page = await listThreads('page=1&limit=2');
    expect(page.map((t) => t.id)).toEqual([second, first]);
  });

  it('agrees with the order the browser keeps', async () => {
    const ids = [await createThread(), await createThread(), await createThread()];
    await pin(ids[0]);

    const items = (await listThreads()).filter((t) => ids.includes(t.id));
    expect([...items].sort(compareThreads).map((t) => t.id)).toEqual(
      items.map((t) => t.id),
    );
  });

  it("does not show another actor's pins", async () => {
    const threadId = await createThread();
    await dataSource
      .getRepository(ThreadPinEntity)
      .insert({ threadId, actorId: agentActorId });

    const item = (await listThreads()).find((t) => t.id === threadId);
    expect(item?.pinned).toBe(false);
  });

  it('returns 404 for a thread that does not exist', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    await pin(missing, 404);
    await unpin(missing, 404);
  });

  it("tells the caller's list sockets when a thread is pinned and unpinned", async () => {
    const threadId = await createThread();
    const socket = await openListSocket();

    const pinned = nextEvent<ThreadPinnedWireEvent>(socket, ThreadWireEvents.THREAD_PINNED);
    await pin(threadId);
    expect((await pinned).payload).toEqual({ threadId, pinned: true });

    const unpinned = nextEvent<ThreadPinnedWireEvent>(socket, ThreadWireEvents.THREAD_PINNED);
    await unpin(threadId);
    expect((await unpinned).payload).toEqual({ threadId, pinned: false });
  });

  describe('the list in the browser', () => {
    const thread = (id: string, lastActivityAt: string, pinned = false): OrderedThread => ({
      id,
      lastActivityAt,
      unreadCount: 0,
      pinned,
    });
    const list = [
      thread('c', '2026-01-03T00:00:00.000Z'),
      thread('b', '2026-01-02T00:00:00.000Z'),
      thread('a', '2026-01-01T00:00:00.000Z'),
    ];

    it('moves a pinned thread to the top', () => {
      expect(applyThreadPinned(list, 'a', true).map((t) => t.id)).toEqual(['a', 'c', 'b']);
    });

    it('moves an unpinned thread back to its place by activity', () => {
      const pinned = applyThreadPinned(list, 'a', true);
      expect(applyThreadPinned(pinned, 'a', false)).toEqual(list);
    });

    it('leaves the list alone for a thread it has not loaded', () => {
      expect(applyThreadPinned(list, 'z', true)).toBe(list);
    });
  });
});
