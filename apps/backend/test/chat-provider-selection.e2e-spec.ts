import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

describe('Chat provider selection E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let dataSource: DataSource;

  const api = (method: 'post' | 'patch' | 'get', path: string) =>
    request(httpServer)[method](`/api/v1${path}`).set('Cookie', authCookies);

  const createThread = async (): Promise<string> =>
    (await api('post', '/threads').send({ title: 'Selection thread' }).expect(201)).body.id;

  const threadSelection = async (threadId: string) => {
    const [row] = await dataSource.query(
      `SELECT chat_provider_id, model_id FROM threads WHERE id = $1`,
      [threadId],
    );
    return row;
  };

  beforeAll(async () => {
    // Storing an API key needs the secrets feature, which needs an encryption key.
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');

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

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('moves every thread to the globally selected provider and model', async () => {
    const existingThreadId = await createThread();

    const anthropic = (
      await api('post', '/chat-providers')
        .send({ name: 'Anthropic', type: 'anthropic', modelId: 'claude-opus-5-5' })
        .expect(201)
    ).body;
    expect(anthropic).toMatchObject({ modelId: 'claude-opus-5-5', isConfigured: false });

    await api('patch', `/chat-providers/${anthropic.id}`).send({ apiKey: 'sk-ant-test' }).expect(200);
    await api('post', '/chat-providers/set-active').send({ providerId: anthropic.id }).expect(201);

    expect(await threadSelection(existingThreadId)).toEqual({
      chat_provider_id: anthropic.id,
      model_id: 'claude-opus-5-5',
    });

    // New threads start on the selection.
    const newThreadId = await createThread();
    expect(await threadSelection(newThreadId)).toEqual({
      chat_provider_id: anthropic.id,
      model_id: 'claude-opus-5-5',
    });

    // Changing the active provider's model moves the threads too.
    await api('patch', `/chat-providers/${anthropic.id}`).send({ modelId: 'claude-sonnet-5-5' }).expect(200);
    expect((await threadSelection(existingThreadId)).model_id).toBe('claude-sonnet-5-5');

    const resolved = await app.get(ChatModelFactory).resolve(
      await threadSelection(existingThreadId).then((row) => ({
        chatProviderId: row.chat_provider_id,
        modelId: row.model_id,
      })),
    );
    expect(resolved).toMatchObject({ providerType: 'anthropic', modelId: 'claude-sonnet-5-5' });
  });

  it('switches threads when another provider is selected', async () => {
    const threadId = await createThread();

    const local = (
      await api('post', '/chat-providers')
        .send({
          name: 'Local',
          type: 'openai_compatible',
          baseUrl: 'http://localhost:11434/v1',
          modelId: 'llama',
        })
        .expect(201)
    ).body;
    expect(local.isConfigured).toBe(true);

    await api('post', '/chat-providers/set-active').send({ providerId: local.id }).expect(201);

    expect(await threadSelection(threadId)).toEqual({
      chat_provider_id: local.id,
      model_id: 'llama',
    });
  });

  it('resolves Vertex AI from stored settings and from the environment', async () => {
    const savedEnv = { ...process.env };
    for (const key of ['GOOGLE_VERTEX_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_VERTEX_LOCATION', 'GOOGLE_CLOUD_LOCATION']) {
      delete process.env[key];
    }

    try {
      const vertex = (
        await api('post', '/chat-providers')
          .send({ name: 'Vertex', type: 'google_vertex', project: 'stored-project', location: 'europe-west4' })
          .expect(201)
      ).body;
      expect(vertex).toMatchObject({ isConfigured: true, project: 'stored-project' });

      const resolved = await app.get(ChatModelFactory).resolve({ chatProviderId: vertex.id });
      expect(resolved).toMatchObject({ providerType: 'google_vertex', modelId: 'gemini-3.6-flash' });

      // With nothing stored and nothing in the environment it is not usable.
      const cleared = (
        await api('patch', `/chat-providers/${vertex.id}`).send({ project: '', location: '' }).expect(200)
      ).body;
      expect(cleared).toMatchObject({ project: null, location: null, isConfigured: false });
      await api('post', '/chat-providers/set-active').send({ providerId: vertex.id }).expect(400);

      // The environment fills in what is not stored.
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'global';
      const fromEnv = (await api('get', `/chat-providers/${vertex.id}`).expect(200)).body;
      expect(fromEnv.isConfigured).toBe(true);
    } finally {
      process.env = savedEnv;
    }
  });

  it('clears the selection on threads when the provider is deactivated', async () => {
    const threadId = await createThread();
    expect((await threadSelection(threadId)).chat_provider_id).not.toBeNull();

    await api('post', '/chat-providers/deactivate').expect(204);

    expect(await threadSelection(threadId)).toEqual({ chat_provider_id: null, model_id: null });
  });
});
