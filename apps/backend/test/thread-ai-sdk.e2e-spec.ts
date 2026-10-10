import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/threads/chat.service';
import { ThreadsService } from '../src/threads/threads.service';
import { AiSdkBackend } from '../src/threads/backends/ai-sdk.backend';
import { ThreadChatHistoryEntity } from '../src/threads/thread-chat-history.entity';
import { ThreadMessageEntity } from '../src/threads/thread-message.entity';
import { ContextService } from '../src/context/context.service';
import { ChatProvidersService } from '../src/chat-providers/chat-providers.service';
import { ChatProviderType } from '../src/chat-providers/enums';
import { ActorEntity } from '../src/identity-provider/actor.entity';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import * as envConfig from '../src/config/env.config';
import { ThreadChatHistory1791580000000 } from '../src/migrations/1791580000000-ThreadChatHistory';
import { AppendOnlyThreadChatHistory1791629000000 } from '../src/migrations/1791629000000-AppendOnlyThreadChatHistory';

describe('Thread AI SDK authenticated MCP integration', () => {
  let app: INestApplication;
  let authCookies: string;
  let actor: ActorEntity;
  let responseConsumer: jest.SpyInstance;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    responseConsumer = jest.spyOn(app.get(ThreadsService) as any, 'consumeResponseStream');
    const config = envConfig.getConfig();
    jest.spyOn(envConfig, 'getConfig').mockReturnValue({ ...config, issuerUrl: await app.getUrl() });
    const actorId = await ensureTestUser(app);
    actor = await app.get(DataSource).getRepository(ActorEntity).findOneByOrFail({ id: actorId });
    authCookies = await getAuthCookies(app.getHttpServer());
    const providers = app.get(ChatProvidersService);
    const provider = await providers.createChatProvider({ name: 'SDK test provider', type: ChatProviderType.ADK });
    await providers.setActiveChatProvider({ providerId: provider.id });
  }, 30000);

  afterAll(async () => {
    // Message insertion precedes relation reload/event emission. Drain the
    // fire-and-forget chat consumers before closing their database connection.
    await Promise.all(responseConsumer?.mock.results.map((result) => result.value) ?? []);
    await app?.close();
    jest.restoreAllMocks();
  });

  it('migrates existing history arrays in order and supports rollback without losing messages', async () => {
    const runner = app.get(DataSource).createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('CREATE SCHEMA thread_history_migration_test');
      await runner.query('SET LOCAL search_path TO thread_history_migration_test, public');
      await runner.query('CREATE TABLE "threads" ("id" uuid PRIMARY KEY)');
      const threadId = '00000000-0000-0000-0000-000000000001';
      await runner.query('INSERT INTO "threads" ("id") VALUES ($1)', [threadId]);
      await new ThreadChatHistory1791580000000().up(runner);
      const messages = [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'call', toolName: 'tasks__fetch', input: {} }] },
        { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call', toolName: 'tasks__fetch', output: { type: 'text', value: 'Task' } }] },
      ];
      await runner.query('INSERT INTO "thread_chat_history" ("thread_id", "messages") VALUES ($1, $2)', [threadId, JSON.stringify(messages)]);
      const migration = new AppendOnlyThreadChatHistory1791629000000();
      await migration.up(runner);
      const rows = await runner.query('SELECT * FROM "thread_chat_history" ORDER BY "sequence" ASC');
      expect(rows.map((row) => row.message)).toEqual(messages);
      expect(new Set(rows.map((row) => row.id)).size).toBe(3);
      expect(new Set(rows.map((row) => row.created_at.getTime())).size).toBe(1);
      const appended = { role: 'assistant', content: 'New answer' };
      await runner.query('INSERT INTO "thread_chat_history" ("thread_id", "message") VALUES ($1, $2)', [threadId, JSON.stringify(appended)]);
      await migration.down(runner);
      const restored = await runner.query('SELECT "messages" FROM "thread_chat_history" WHERE "thread_id" = $1', [threadId]);
      expect(restored[0].messages).toEqual([...messages, appended]);
      await migration.up(runner);
      await runner.query('DELETE FROM "threads" WHERE "id" = $1', [threadId]);
      expect(await runner.query('SELECT * FROM "thread_chat_history"')).toEqual([]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('runs a real MCP context update through the middle-manager SDK tool loop', async () => {
    const block = await app.get(ContextService).createBlock({
      title: 'SDK state memory', content: 'Old decision', createdByActorId: actor.id,
    });
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const model = new MockLanguageModelV4({ doGenerate: [
      {
        content: [{ type: 'tool-call', toolCallId: 'update-state', toolName: 'context__update_block',
          input: JSON.stringify({ blockId: block.id, content: 'Durable shared decision' }) }],
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage, warnings: [],
      },
      { content: [], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] },
    ] });
    jest.spyOn(app.get(AiSdkBackend) as any, 'getModel').mockResolvedValue(model);
    await app.get(ChatService).runTask({ instructions: 'Reconcile shared memory', prompt: 'Update state', actor });
    const updated = await request(app.getHttpServer())
      .get(`/api/v1/context/blocks/${block.id}`).set('Cookie', authCookies).expect(200);
    expect(updated.body.content).toBe('Durable shared decision');
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0].tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'context__update_block' }),
      expect.objectContaining({ name: 'tasks__fetch' }),
    ]));
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('Durable shared decision');
  });

  it('streams chat through authenticated MCP and saves tool history across consecutive turns', async () => {
    const task = await request(app.getHttpServer()).post('/api/v1/tasks/tasks')
      .set('Cookie', authCookies).send({ name: 'SDK chat task', description: 'Inspect this task' }).expect(201);
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const model = new MockLanguageModelV4({
      doGenerate: { content: [{ type: 'text', text: 'SDK chat' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] },
      doStream: async () => {
        const chunks: LanguageModelV4StreamPart[] = model.doStreamCalls.length === 1
          ? [
            { type: 'tool-call', toolCallId: 'fetch-task', toolName: 'tasks__fetch', input: JSON.stringify({ taskId: task.body.id }) },
            { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage },
          ]
          : [
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: 'Task inspected' },
            { type: 'text-end', id: 'answer' },
            { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
          ];
        return { stream: simulateReadableStream({ chunks }) };
      },
    });
    jest.spyOn(app.get(AiSdkBackend) as any, 'getModel').mockResolvedValue(model);
    const thread = await request(app.getHttpServer()).post('/api/v1/threads')
      .set('Cookie', authCookies).send({ title: 'SDK chat thread', parentTaskId: task.body.id }).expect(201);
    const dataSource = app.get(DataSource);
    const waitForAnswer = async (expected: number) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const messages = await dataSource.getRepository(ThreadMessageEntity).findBy({ threadId: thread.body.id, content: 'Task inspected' });
        if (messages.length === expected) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('Timed out waiting for persisted SDK response');
    };
    await request(app.getHttpServer()).post(`/api/v1/threads/${thread.body.id}/messages`)
      .set('Cookie', authCookies).send({ content: 'Inspect the task' }).expect(201);
    await waitForAnswer(1);
    const historyRepository = dataSource.getRepository(ThreadChatHistoryEntity);
    const firstHistory = await historyRepository.find({ where: { threadId: thread.body.id }, order: { sequence: 'ASC' } });
    expect(firstHistory.some((row) => row.message.role === 'tool')).toBe(true);
    expect(JSON.stringify(firstHistory.map((row) => row.message))).toContain('SDK chat task');
    // A single batch has equal timestamps, but must retain assistant/tool order.
    expect(firstHistory.map((row) => row.message.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);

    await request(app.getHttpServer()).post(`/api/v1/threads/${thread.body.id}/messages`)
      .set('Cookie', authCookies).send({ content: 'Continue' }).expect(201);
    await waitForAnswer(2);
    const secondHistory = await historyRepository.find({ where: { threadId: thread.body.id }, order: { sequence: 'ASC' } });
    expect(secondHistory.filter((row) => row.message.role === 'user')).toHaveLength(2);
    expect(secondHistory.slice(0, firstHistory.length)).toEqual(firstHistory);
    expect(model.doStreamCalls[2].prompt.some((message) => message.role === 'tool')).toBe(true);
  });
});
