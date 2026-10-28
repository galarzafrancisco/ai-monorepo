import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { createVerify, generateKeyPairSync, randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { GithubConnectionsService } from '../src/integrations/github-connections.service';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { FakeGithub, patUsers } from './helpers/fake-github';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('GitHub connections E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let ds: DataSource;
  let cookies: string;
  const github = new FakeGithub();

  const api = (method: 'post' | 'patch' | 'get' | 'delete', path: string) =>
    request(http)[method](`/api/v1${path}`).set('Cookie', cookies);

  const liveSecrets = async (): Promise<number> =>
    Number((await ds.query(`SELECT count(*) AS n FROM secrets WHERE deleted_at IS NULL`))[0].n);

  beforeAll(async () => {
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
    await github.start();
    process.env.GITHUB_API_URL = github.url;

    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
  }, 30000);

  beforeEach(async () => {
    github.reset();
    await ds.query(`UPDATE projects SET github_connection_id = NULL`);
    await ds.query(`DELETE FROM github_connections`);
  });

  afterAll(async () => {
    await app.close();
    await github.stop();
    delete process.env.GITHUB_API_URL;
  });

  it('checks a token with GitHub, stores it as a secret and never returns it', async () => {
    github.routes = [patUsers({ 'good-token': 'octocat' })];
    const secretsBefore = await liveSecrets();

    const created = await api('post', '/integrations/github/connections')
      .send({ name: ' Mine ', authType: 'pat', secret: ' good-token ' })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Mine',
      authType: 'pat',
      accountLogin: 'octocat',
      owners: ['octocat'],
      lastError: null,
    });
    expect(JSON.stringify(created.body)).not.toContain('good-token');
    expect(github.requests[0].authorization).toBe('Bearer good-token');
    expect(await liveSecrets()).toBe(secretsBefore + 1);

    const token = await app.get(GithubConnectionsService).getAccessToken(created.body.id);
    expect(token).toEqual({ token: 'good-token', expiresAt: null });
  });

  it('refuses a token GitHub rejects and stores nothing', async () => {
    github.routes = [patUsers({})];
    const secretsBefore = await liveSecrets();

    const response = await api('post', '/integrations/github/connections')
      .send({ name: 'Bad', authType: 'pat', secret: 'nope' })
      .expect(400);

    expect(response.body.code).toBe('GITHUB_CONNECTION_INVALID');
    expect(response.body.detail).toContain('Bad credentials');
    expect(await liveSecrets()).toBe(secretsBefore);
    await api('get', '/integrations/github/connections').expect(200, []);
  });

  it('authenticates a GitHub App with a signed JWT and mints installation tokens', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const verifiesAsApp = (authorization: string | null): boolean => {
      const [header, payload, signature] = (authorization ?? '').replace(/^Bearer /, '').split('.');
      if (!signature) return false;
      const verifier = createVerify('RSA-SHA256');
      verifier.update(`${header}.${payload}`);
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return claims.iss === '42' && verifier.verify(publicKey, Buffer.from(signature, 'base64url'));
    };
    github.routes = [
      (req) =>
        req.method === 'GET' && req.path === '/app/installations/7'
          ? verifiesAsApp(req.authorization)
            ? { status: 200, body: { account: { login: 'acme' } } }
            : { status: 401, body: { message: 'A JSON web token could not be decoded' } }
          : undefined,
      (req) =>
        req.method === 'POST' && req.path === '/app/installations/7/access_tokens' && verifiesAsApp(req.authorization)
          ? { status: 201, body: { token: 'ghs_installation', expires_at: new Date(Date.now() + 3600_000).toISOString() } }
          : undefined,
    ];

    const created = await api('post', '/integrations/github/connections')
      .send({ name: 'Acme app', authType: 'app', secret: pem, appId: '42', installationId: '7' })
      .expect(201);
    expect(created.body).toMatchObject({ authType: 'app', appId: '42', installationId: '7', accountLogin: 'acme', owners: ['acme'] });

    const service = app.get(GithubConnectionsService);
    const first = await service.getAccessToken(created.body.id);
    const second = await service.getAccessToken(created.body.id);
    expect(first.token).toBe('ghs_installation');
    expect(second).toBe(first);
    expect(github.requests.filter((r) => r.path.endsWith('/access_tokens'))).toHaveLength(1);

    await api('post', '/integrations/github/connections')
      .send({ name: 'No ids', authType: 'app', secret: pem })
      .expect(400);
  });

  it('picks the project connection, then the owner, then the only connection', async () => {
    github.routes = [patUsers({ a: 'alice', b: 'bob' })];
    const resolve = async (repoUrl: string, connectionId?: string) =>
      (
        await api('get', '/integrations/github/connections/resolve')
          .query({ repoUrl, ...(connectionId ? { connectionId } : {}) })
          .expect(200)
      ).body;

    const alice = (await api('post', '/integrations/github/connections').send({ name: 'A', authType: 'pat', secret: 'a' }).expect(201)).body;
    expect(await resolve('git@github.com:someone/else.git')).toMatchObject({ connection: { id: alice.id }, match: 'only_connection' });

    const bob = (
      await api('post', '/integrations/github/connections')
        .send({ name: 'B', authType: 'pat', secret: 'b', owners: ['Acme', ' acme ', ''] })
        .expect(201)
    ).body;
    expect(bob.owners).toEqual(['Acme']);
    // Clearing the owners falls back to the account, like on creation.
    const cleared = (await api('patch', `/integrations/github/connections/${bob.id}`).send({ owners: [] }).expect(200)).body;
    expect(cleared.owners).toEqual(['bob']);
    await api('patch', `/integrations/github/connections/${bob.id}`).send({ owners: ['Acme'] }).expect(200);

    expect(await resolve('https://github.com/acme/api')).toMatchObject({ repository: { owner: 'acme', repo: 'api' }, connection: { id: bob.id }, match: 'owner' });
    expect(await resolve('https://github.com/alice/x')).toMatchObject({ connection: { id: alice.id }, match: 'owner' });
    expect(await resolve('https://github.com/someone/else')).toMatchObject({ connection: null, match: null });
    expect(await resolve('https://github.com/acme/api', alice.id)).toMatchObject({ connection: { id: alice.id }, match: 'project' });
    expect(await resolve('https://gitlab.com/acme/api')).toEqual({ repository: null, connection: null, match: null });
  });

  it('lets a project name a connection and falls back to automatic when it is deleted', async () => {
    github.routes = [patUsers({ a: 'alice' })];
    const connection = (await api('post', '/integrations/github/connections').send({ name: 'A', authType: 'pat', secret: 'a' }).expect(201)).body;
    const project = (
      await api('post', '/meta/projects')
        .send({ slug: `gh-${Date.now()}`, repoUrl: 'https://github.com/alice/x', githubConnectionId: connection.id, githubForWorker: true })
        .expect(201)
    ).body;
    expect(project).toMatchObject({ githubConnectionId: connection.id, githubForWorker: true });

    await api('patch', `/meta/projects/${project.id}`).send({ githubConnectionId: MISSING_ID }).expect(404);

    const secretsBefore = await liveSecrets();
    await api('delete', `/integrations/github/connections/${connection.id}`).expect(204);
    expect(await liveSecrets()).toBe(secretsBefore - 1);

    const after = (await api('get', `/meta/projects/${project.id}`).expect(200)).body;
    expect(after).toMatchObject({ githubConnectionId: null, githubForWorker: true });
  });

  it('records why a stored credential stopped working', async () => {
    github.routes = [patUsers({ a: 'alice' })];
    const connection = (await api('post', '/integrations/github/connections').send({ name: 'A', authType: 'pat', secret: 'a' }).expect(201)).body;

    github.routes = [patUsers({})];
    const checked = (await api('post', `/integrations/github/connections/${connection.id}/verify`).expect(200)).body;
    expect(checked.lastError).toContain('Bad credentials');

    github.routes = [patUsers({ fresh: 'alice' })];
    const updated = (await api('patch', `/integrations/github/connections/${connection.id}`).send({ secret: 'fresh' }).expect(200)).body;
    expect(updated.lastError).toBeNull();
    expect((await app.get(GithubConnectionsService).getAccessToken(connection.id)).token).toBe('fresh');
  });
});
