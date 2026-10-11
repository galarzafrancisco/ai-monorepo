import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AiModelJob } from '../src/ai-providers/enums';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

describe('AI model selection E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let dataSource: DataSource;

  const api = (method: 'post' | 'patch' | 'get' | 'put' | 'delete', path: string) =>
    request(httpServer)[method](`/api/v1${path}`).set('Cookie', authCookies);

  const createThread = async (): Promise<string> =>
    (await api('post', '/threads').send({ title: 'Selection thread' }).expect(201)).body.id;

  const threadSelection = async (threadId: string) => {
    const [row] = await dataSource.query(
      `SELECT ai_provider_id, model_id FROM threads WHERE id = $1`,
      [threadId],
    );
    return row;
  };

  const factory = () => app.get(ChatModelFactory);

  const selections = async (): Promise<Record<string, Record<string, unknown>>> => {
    const list: Array<{ job: string }> = (await api('get', '/ai-model-selections').expect(200)).body;
    return Object.fromEntries(list.map((selection) => [selection.job, selection]));
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

  it('selects a different provider and model per job, with quick tasks and the middle manager following the conversation', async () => {
    const threadId = await createThread();

    // Nothing selected: no job can run.
    expect(await selections()).toMatchObject({
      conversation: { modelId: null, isReady: false, followsConversation: false },
      quick_tasks: { modelId: null, isReady: false, followsConversation: true },
      middle_manager: { modelId: null, isReady: false, followsConversation: true },
      embeddings: { modelId: null, isReady: false, followsConversation: false },
    });
    await expect(factory().resolve({ job: AiModelJob.CONVERSATION })).rejects.toMatchObject({
      code: 'AI_MODEL_NOT_SELECTED',
    });

    const anthropic = (
      await api('post', '/ai-providers').send({ name: 'Anthropic', type: 'anthropic' }).expect(201)
    ).body;
    expect(anthropic).toMatchObject({ isConfigured: false });
    expect(anthropic).not.toHaveProperty('modelId');
    expect(anthropic).not.toHaveProperty('isActive');

    // A selection can be made before the provider has credentials; it is just not ready yet.
    const selected = (
      await api('put', '/ai-model-selections/conversation')
        .send({ aiProviderId: anthropic.id, modelId: 'claude-opus-5-5' })
        .expect(200)
    ).body;
    expect(selected).toMatchObject({ modelId: 'claude-opus-5-5', isReady: false });

    await api('patch', `/ai-providers/${anthropic.id}`).send({ apiKey: 'sk-ant-test' }).expect(200);

    expect(await selections()).toMatchObject({
      conversation: { modelId: 'claude-opus-5-5', isReady: true },
      quick_tasks: {
        modelId: null,
        followsConversation: true,
        effectiveModelId: 'claude-opus-5-5',
        isReady: true,
      },
      middle_manager: { effectiveModelId: 'claude-opus-5-5', isReady: true },
      embeddings: { effectiveModelId: null, isReady: false },
    });

    // Threads store nothing and follow the conversation selection.
    expect(await threadSelection(threadId)).toEqual({ ai_provider_id: null, model_id: null });
    expect(await threadSelection(await createThread())).toEqual({
      ai_provider_id: null,
      model_id: null,
    });

    // Quick tasks on another provider and model.
    const local = (
      await api('post', '/ai-providers')
        .send({ name: 'Local', type: 'openai_compatible', baseUrl: 'http://localhost:11434/v1' })
        .expect(201)
    ).body;
    expect(local.isConfigured).toBe(true);
    await api('put', '/ai-model-selections/quick_tasks')
      .send({ aiProviderId: local.id, modelId: 'llama-small' })
      .expect(200);

    expect(await factory().resolve({ job: AiModelJob.CONVERSATION })).toMatchObject({
      providerType: 'anthropic',
      modelId: 'claude-opus-5-5',
    });
    expect(await factory().resolve({ job: AiModelJob.QUICK_TASKS })).toMatchObject({
      providerType: 'openai_compatible',
      modelId: 'llama-small',
    });
    expect(await factory().resolve({ job: AiModelJob.MIDDLE_MANAGER })).toMatchObject({
      providerType: 'anthropic',
      modelId: 'claude-opus-5-5',
    });

    // Changing the conversation model needs no write to any thread.
    await api('put', '/ai-model-selections/conversation')
      .send({ aiProviderId: anthropic.id, modelId: 'claude-sonnet-5-5' })
      .expect(200);
    expect((await factory().resolve({ job: AiModelJob.CONVERSATION })).modelId).toBe(
      'claude-sonnet-5-5',
    );
    expect(await threadSelection(threadId)).toEqual({ ai_provider_id: null, model_id: null });

    // Clearing a job's own selection sends it back to the conversation model.
    await api('delete', '/ai-model-selections/quick_tasks').expect(204);
    expect((await factory().resolve({ job: AiModelJob.QUICK_TASKS })).modelId).toBe(
      'claude-sonnet-5-5',
    );
  });

  it('rejects unknown jobs and unknown providers', async () => {
    await api('put', '/ai-model-selections/nonsense')
      .send({ aiProviderId: randomUUID(), modelId: 'x' })
      .expect(400);
    await api('put', '/ai-model-selections/embeddings')
      .send({ aiProviderId: randomUUID(), modelId: 'x' })
      .expect(404);
  });

  it('refuses to delete a provider that a job still uses', async () => {
    const provider = (
      await api('post', '/ai-providers')
        .send({ name: 'Embedder', type: 'openai_compatible', baseUrl: 'http://localhost:11434/v1' })
        .expect(201)
    ).body;
    await api('put', '/ai-model-selections/embeddings')
      .send({ aiProviderId: provider.id, modelId: 'embed-small' })
      .expect(200);

    const refused = await api('delete', `/ai-providers/${provider.id}`).expect(409);
    expect(refused.body).toMatchObject({ code: 'AI_PROVIDER_IN_USE' });

    await api('delete', '/ai-model-selections/embeddings').expect(204);
    await api('delete', `/ai-providers/${provider.id}`).expect(204);
  });

  it('lists the models a provider offers, split into language and embedding models', async () => {
    const llm = createServer((req, res) => {
      if (req.url === '/v1/models' && req.headers.authorization === 'Bearer sk-local') {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            data: [{ id: 'zeta-chat' }, { id: 'text-embedding-small' }, { id: 'alpha-chat' }],
          }),
        );
        return;
      }
      res.statusCode = 401;
      res.end('{"error":"bad key"}');
    });
    await new Promise<void>((resolve) => llm.listen(0, '127.0.0.1', resolve));
    const { port } = llm.address() as AddressInfo;

    try {
      const provider = (
        await api('post', '/ai-providers')
          .send({ name: 'Listed', type: 'openai_compatible', baseUrl: `http://127.0.0.1:${port}/v1` })
          .expect(201)
      ).body;

      // Without the key the provider refuses, and the reason reaches the caller.
      const failed = await api('get', `/ai-providers/${provider.id}/models`).expect(502);
      expect(failed.body).toMatchObject({ code: 'AI_PROVIDER_MODEL_LISTING_FAILED' });
      expect(failed.body.detail).toContain('401');

      await api('patch', `/ai-providers/${provider.id}`).send({ apiKey: 'sk-local' }).expect(200);
      const models = (await api('get', `/ai-providers/${provider.id}/models`).expect(200)).body;
      expect(models).toEqual([
        { id: 'alpha-chat', displayName: null, kind: 'language' },
        { id: 'text-embedding-small', displayName: null, kind: 'embedding' },
        { id: 'zeta-chat', displayName: null, kind: 'language' },
      ]);

      // xAI lists models the same way; its own endpoint is replaced by the fake one here.
      const grok = (
        await api('post', '/ai-providers')
          .send({ name: 'Grok', type: 'xai', baseUrl: `http://127.0.0.1:${port}/v1` })
          .expect(201)
      ).body;
      expect(grok).toMatchObject({ type: 'xai', isConfigured: false });
      await api('patch', `/ai-providers/${grok.id}`).send({ apiKey: 'sk-local' }).expect(200);
      const grokModels = (await api('get', `/ai-providers/${grok.id}/models`).expect(200)).body;
      expect(grokModels.map((model: { id: string }) => model.id)).toEqual([
        'alpha-chat',
        'text-embedding-small',
        'zeta-chat',
      ]);

      await api('put', '/ai-model-selections/quick_tasks')
        .send({ aiProviderId: grok.id, modelId: 'grok-4' })
        .expect(200);
      expect(await factory().resolve({ job: AiModelJob.QUICK_TASKS })).toMatchObject({
        providerType: 'xai',
        modelId: 'grok-4',
      });
      await api('delete', '/ai-model-selections/quick_tasks').expect(204);
    } finally {
      await new Promise((resolve) => llm.close(resolve));
    }
  });

  it('resolves Vertex AI from stored settings and from the environment', async () => {
    const savedEnv = { ...process.env };
    for (const key of ['GOOGLE_VERTEX_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_VERTEX_LOCATION', 'GOOGLE_CLOUD_LOCATION']) {
      delete process.env[key];
    }

    try {
      const vertex = (
        await api('post', '/ai-providers')
          .send({ name: 'Vertex', type: 'google_vertex', project: 'stored-project', location: 'europe-west4' })
          .expect(201)
      ).body;
      expect(vertex).toMatchObject({ isConfigured: true, project: 'stored-project' });

      await api('put', '/ai-model-selections/middle_manager')
        .send({ aiProviderId: vertex.id, modelId: 'gemini-3.6-flash' })
        .expect(200);
      const resolved = await factory().resolve({ job: AiModelJob.MIDDLE_MANAGER });
      expect(resolved).toMatchObject({ providerType: 'google_vertex', modelId: 'gemini-3.6-flash' });

      // With nothing stored and nothing in the environment it is not usable.
      const cleared = (
        await api('patch', `/ai-providers/${vertex.id}`).send({ project: '', location: '' }).expect(200)
      ).body;
      expect(cleared).toMatchObject({ project: null, location: null, isConfigured: false });
      expect((await selections()).middle_manager.isReady).toBe(false);

      // The environment fills in what is not stored.
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'global';
      const fromEnv = (await api('get', `/ai-providers/${vertex.id}`).expect(200)).body;
      expect(fromEnv.isConfigured).toBe(true);
      expect((await selections()).middle_manager.isReady).toBe(true);
    } finally {
      process.env = savedEnv;
    }
  });
});
