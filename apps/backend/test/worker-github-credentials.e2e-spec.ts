import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { AgentsService } from '../src/agents/agents.service';
import { ActiveTaskExecutionEntity } from '../src/executions/active/active-task-execution.entity';
import { TaskStatus } from '../src/tasks/enums';
import { AccessTokenValidationService } from '../src/auth/guards/validation/access-token-validation.service';
import { WorkersScopes } from '../src/executions/workers.scopes';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { FakeGithub, patUsers } from './helpers/fake-github';

describe('Worker GitHub credentials E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let ds: DataSource;
  let cookies: string;
  let agentActorId: string;
  let tokenSpy: jest.SpyInstance;
  const github = new FakeGithub();
  const mintedFor: unknown[] = [];

  const api = (method: 'post' | 'get', path: string) => request(http)[method](`/api/v1${path}`).set('Cookie', cookies);
  const asWorker = (clientId: string, executionId: string) =>
    request(http)
      .post(`/api/v1/executions/active/${executionId}/github-credentials`)
      .set('Authorization', `Bearer ${clientId}`);

  const createProject = async (slug: string, repoUrl: string, githubForWorker: boolean) =>
    (await api('post', '/meta/projects').send({ slug, repoUrl, githubForWorker }).expect(201)).body;

  beforeAll(async () => {
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
    await github.start();
    process.env.GITHUB_API_URL = github.url;

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(http);
    // Connections left by other suites hold secrets encrypted with their own key
    // (each suite gets its own SECRETS_ENCRYPTION_KEY) and would match these owners first.
    await ds.query(`UPDATE projects SET github_connection_id = NULL`);
    await ds.query(`DELETE FROM github_connections`);
    agentActorId = (
      await app.get(AgentsService).createAgent({
        slug: `gh-${randomUUID()}`,
        name: 'GitHub agent',
        systemPrompt: 'test',
        statusTriggers: [],
        allowedTools: [],
      })
    ).actorId;

    const validator = app.get(AccessTokenValidationService);
    const original = validator.validateAccessToken.bind(validator);
    tokenSpy = jest.spyOn(validator, 'validateAccessToken').mockImplementation(async (token, ...args) => {
      if (token === 'gh-owner' || token === 'gh-stranger') {
        return {
          sub: 'worker',
          client_id: token,
          scope: [WorkersScopes.CONNECT.id],
          aud: 'ai-backend',
          exp: Math.floor(Date.now() / 1000) + 3600,
        } as never;
      }
      return original(token, ...args);
    });
  }, 60000);

  afterAll(async () => {
    tokenSpy?.mockRestore();
    await app.close();
    await github.stop();
    delete process.env.GITHUB_API_URL;
  });

  it('gives the claiming worker one token per project that allows it, and nothing to anyone else', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    github.routes = [
      patUsers({ 'pat-token': 'alice' }),
      (req) =>
        req.method === 'GET' && req.path === '/api/v3/user' && req.authorization === 'Bearer ghes-token'
          ? { status: 200, body: { login: 'corp-alice' } }
          : undefined,
      (req) =>
        req.method === 'GET' && req.path === '/app/installations/7'
          ? { status: 200, body: { account: { login: 'acme' } } }
          : undefined,
      (req) => {
        if (req.method !== 'POST' || req.path !== '/app/installations/7/access_tokens') return undefined;
        mintedFor.push(req.body);
        return { status: 201, body: { token: 'ghs_scoped', expires_at: new Date(Date.now() + 3600_000).toISOString() } };
      },
    ];
    await api('post', '/integrations/github/connections').send({ name: 'Alice', authType: 'pat', secret: 'pat-token' }).expect(201);
    await api('post', '/integrations/github/connections')
      .send({ name: 'Acme', authType: 'app', secret: pem, appId: '42', installationId: '7' })
      .expect(201);
    await api('post', '/integrations/github/connections')
      .send({ name: 'Work', authType: 'pat', secret: 'ghes-token', baseUrl: github.url })
      .expect(201);

    const suffix = randomUUID().slice(0, 8);
    const projects = [
      await createProject(`pat-${suffix}`, 'git@github.com:alice/tool.git', true),
      await createProject(`app-${suffix}`, 'https://github.com/acme/api', true),
      await createProject(`off-${suffix}`, 'https://github.com/alice/private', false),
      await createProject(`lab-${suffix}`, 'https://gitlab.com/acme/api', true),
      await createProject(`ghe-${suffix}`, `${github.url}/corp/service.git`, true),
    ];

    const task = (await api('post', '/tasks/tasks').send({ name: 'Ship it', description: 'x' }).expect(201)).body;
    for (const project of projects) {
      await ds.query(`INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)`, [task.id, project.tagId]);
    }
    const execution = await ds.getRepository(ActiveTaskExecutionEntity).save({
      taskId: task.id,
      agentActorId,
      workerClientId: 'gh-owner',
      claimedAt: new Date(),
      taskStatusBeforeClaim: TaskStatus.NOT_STARTED,
      taskTagsBeforeClaim: [],
      taskAssigneeActorIdBeforeClaim: null,
      lastHeartbeatAt: new Date(),
      toolCallCount: 0,
    });

    const { credentials } = (await asWorker('gh-owner', execution.id).expect(200)).body;
    expect(credentials).toEqual([
      expect.objectContaining({
        projectSlug: `app-${suffix}`,
        cloneUrl: 'https://github.com/acme/api.git',
        token: 'ghs_scoped',
        authType: 'app',
        expiresAt: expect.any(String),
      }),
      expect.objectContaining({
        projectSlug: `ghe-${suffix}`,
        cloneUrl: `${github.url}/corp/service.git`,
        host: new URL(github.url).host,
        token: 'ghes-token',
        authType: 'pat',
      }),
      expect.objectContaining({
        projectSlug: `pat-${suffix}`,
        cloneUrl: 'https://github.com/alice/tool.git',
        host: 'github.com',
        token: 'pat-token',
        authType: 'pat',
        expiresAt: null,
      }),
    ]);
    // The App token only reaches the project's repository.
    expect(mintedFor).toEqual([{ repositories: ['api'] }]);

    await asWorker('gh-stranger', execution.id).expect(403);
    await asWorker('gh-owner', randomUUID()).expect(404);
    await request(http).post(`/api/v1/executions/active/${execution.id}/github-credentials`).expect(401);
  });
});
