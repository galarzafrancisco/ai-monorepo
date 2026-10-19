import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ThreadMessageEntity } from '../src/threads/thread-message.entity';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

/**
 * Deleting a thread removes it for real, with its state block and everything
 * that hangs off it. A soft delete used to leave the state block pinned to the
 * deleted thread: it could not be deleted, and the context page linked to a
 * thread that no longer opened.
 */
describe('Thread deletion E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let userActorId: string;
  let dataSource: DataSource;

  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
    request(httpServer)[method](`/api/v1${path}`).set('Cookie', authCookies);

  const createThread = async (body: Record<string, unknown> = {}) => {
    const response = await api('post', '/threads')
      .send({ title: 'Doomed thread', ...body })
      .expect(201);
    return response.body as { id: string; stateContextBlockId: string };
  };

  const countRows = async (table: string, column: string, id: string): Promise<number> => {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT count(*) AS count FROM "${table}" WHERE "${column}" = $1`,
      [id],
    );
    return Number(rows[0].count);
  };

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
    await app.init();

    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);
    userActorId = await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('deletes the thread, its state block and every row that belonged to it', async () => {
    const referenced = await api('post', '/context/blocks')
      .send({ title: 'Referenced block', content: 'Stays.' })
      .expect(201);
    const thread = await createThread({
      tagNames: ['doomed'],
      contextBlockIds: [referenced.body.id],
      participantActorIds: [userActorId],
    });
    await dataSource.getRepository(ThreadMessageEntity).save({
      threadId: thread.id,
      content: 'hello',
      createdByActorId: userActorId,
    });
    await api('put', `/threads/${thread.id}/pin`).expect(204);
    await api('post', `/threads/${thread.id}/read`).expect(204);

    // Before: the block is the thread's state, so the context page links to it.
    const before = await api('get', `/threads/by-state-block/${thread.stateContextBlockId}`).expect(200);
    expect(before.body.map((t: { id: string }) => t.id)).toEqual([thread.id]);

    await api('delete', `/threads/${thread.id}`).expect(204);

    await api('get', `/threads/${thread.id}`).expect(404);
    await api('get', `/context/blocks/${thread.stateContextBlockId}`).expect(404);
    // No thread left to link to from the context page.
    const after = await api('get', `/threads/by-state-block/${thread.stateContextBlockId}`).expect(200);
    expect(after.body).toEqual([]);

    // Nothing stale left behind in SQL, not even a soft-deleted row.
    expect(await countRows('threads', 'id', thread.id)).toBe(0);
    expect(await countRows('context_blocks', 'id', thread.stateContextBlockId)).toBe(0);
    for (const table of [
      'thread_messages',
      'thread_tags',
      'thread_context_blocks',
      'thread_participants',
      'thread_pins',
      'thread_read_states',
    ]) {
      expect({ table, rows: await countRows(table, 'thread_id', thread.id) }).toEqual({ table, rows: 0 });
    }

    // A block the thread only referenced is not the thread's: it stays.
    await api('get', `/context/blocks/${referenced.body.id}`).expect(200);
  });

  it('frees the parent task: it can get a new thread, or be deleted', async () => {
    const task = await api('post', '/tasks/tasks')
      .send({ name: 'Parent of a deleted thread', description: 'Thread deletion test' })
      .expect(201);
    const first = await createThread({ parentTaskId: task.body.id });

    await api('delete', `/threads/${first.id}`).expect(204);

    const second = await createThread({ parentTaskId: task.body.id });
    const byTask = await api('get', `/threads/by-task/${task.body.id}`).expect(200);
    expect(byTask.body.id).toBe(second.id);

    await api('delete', `/threads/${second.id}`).expect(204);
    await api('delete', `/tasks/tasks/${task.body.id}`).expect(204);
  });

  it('keeps a state block that has blocks nested under it, as an ordinary deletable block', async () => {
    const thread = await createThread();
    const child = await api('post', '/context/blocks')
      .send({ title: 'Nested note', content: 'Under the state block.', parentId: thread.stateContextBlockId })
      .expect(201);

    await api('delete', `/threads/${thread.id}`).expect(204);

    await api('get', `/context/blocks/${thread.stateContextBlockId}`).expect(200);
    const after = await api('get', `/threads/by-state-block/${thread.stateContextBlockId}`).expect(200);
    expect(after.body).toEqual([]);

    // No longer a thread's state, so only the usual child rule applies.
    await api('delete', `/context/blocks/${child.body.id}`).expect(204);
    await api('delete', `/context/blocks/${thread.stateContextBlockId}`).expect(204);
  });

  it('still refuses to delete the state block of a live thread', async () => {
    const thread = await createThread();

    const response = await api('delete', `/context/blocks/${thread.stateContextBlockId}`).expect(400);
    expect(response.body.detail).toContain('thread');

    await api('delete', `/threads/${thread.id}`).expect(204);
  });

  it('answers 404 when the thread is already gone', async () => {
    const thread = await createThread();
    await api('delete', `/threads/${thread.id}`).expect(204);
    await api('delete', `/threads/${thread.id}`).expect(404);
  });
});
