import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { createHmac, randomBytes } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { PullRequestsService } from '../src/pull-requests/pull-requests.service';
import { PullRequestUpdatedEvent } from '../src/pull-requests/events/pull-requests.events';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { FakeGithub, FakePull, patUsers, pullRequestRoutes } from './helpers/fake-github';

async function eventually<T>(check: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

describe('Pull requests E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let ds: DataSource;
  let cookies: string;
  const github = new FakeGithub();
  const events: PullRequestUpdatedEvent[] = [];

  const api = (method: 'post' | 'patch' | 'get' | 'delete', path: string) =>
    request(http)[method](`/api/v1${path}`).set('Cookie', cookies);

  let pull: FakePull;
  const openPull = (): FakePull => ({
    title: 'Add search',
    state: 'open',
    merged: false,
    draft: false,
    sha: 'sha1',
    comments: 1,
    checkRuns: [
      { name: 'build', status: 'completed', conclusion: 'success' },
      { name: 'lint', status: 'in_progress', conclusion: null },
      { name: 'optional', status: 'completed', conclusion: 'skipped' },
    ],
    statuses: [{ context: 'deploy-preview', state: 'success' }],
    reviews: [],
  });

  const pollDue = () => app.get(PullRequestsService).fetchDue(50);

  beforeAll(async () => {
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
    await github.start();
    process.env.GITHUB_API_URL = github.url;

    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(http);
    app.get(EventEmitter2).on(PullRequestUpdatedEvent.INTERNAL, (event: PullRequestUpdatedEvent) => events.push(event));
  }, 30000);

  beforeEach(async () => {
    github.reset();
    events.length = 0;
    pull = openPull();
    await ds.query(`DELETE FROM pull_request_references`);
    await ds.query(`DELETE FROM pull_requests`);
    await ds.query(`UPDATE projects SET github_connection_id = NULL`);
    await ds.query(`DELETE FROM github_connections`);
    github.routes = [patUsers({ token: 'acme-bot' }), pullRequestRoutes('acme', 'api', 7, () => pull)];
  });

  afterAll(async () => {
    await app.close();
    await github.stop();
    delete process.env.GITHUB_API_URL;
  });

  it('reads a pull request the first time it is looked up and summarizes CI and reviews', async () => {
    const [pr] = (
      await api('post', '/pull-requests/lookup').send({ refs: ['https://github.com/Acme/API/pull/7/files'] }).expect(200)
    ).body;

    expect(pr).toMatchObject({
      key: 'acme/api#7',
      owner: 'acme',
      repo: 'api',
      number: 7,
      url: 'https://github.com/acme/api/pull/7',
      title: 'Add search',
      state: 'open',
      draft: false,
      additions: 123,
      deletions: 32,
      changedFiles: 4,
      checksStatus: 'pending',
      checksTotal: 3,
      checksPassed: 2,
      checksPending: 1,
      checksFailed: 0,
      reviewDecision: 'none',
      approvals: 0,
      lastError: null,
    });
    // Anonymous: no connection exists.
    expect(github.requests.every((r) => r.authorization === null)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].changes).toEqual([]);

    await api('post', '/pull-requests/lookup').send({ refs: ['nope'] }).expect(400);
  });

  it('uses the matching connection, reuses unchanged answers and reports what changed', async () => {
    await api('post', '/integrations/github/connections').send({ name: 'Acme', authType: 'pat', secret: 'token', owners: ['acme'] }).expect(201);
    const [first] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#7'] }).expect(200)).body;
    expect(github.requests.filter((r) => r.path.startsWith('/repos')).every((r) => r.authorization === 'Bearer token')).toBe(true);

    // Nothing changed: all four requests come back 304 and nothing is emitted.
    github.requests.length = 0;
    events.length = 0;
    await app.get(PullRequestsService).refresh(first.id);
    const repoRequests = github.requests.filter((r) => r.path.startsWith('/repos'));
    expect(repoRequests).toHaveLength(4);
    expect(repoRequests.every((r) => r.ifNoneMatch)).toBe(true);
    expect(events).toHaveLength(0);

    // CI fails, someone approves, someone comments.
    pull.checkRuns[1] = { name: 'lint', status: 'completed', conclusion: 'failure' };
    pull.reviews = [{ user: { login: 'reviewer' }, state: 'APPROVED' }];
    pull.comments = 2;
    const failed = (await api('post', `/pull-requests/${first.id}/refresh`).expect(200)).body;
    expect(failed).toMatchObject({ checksStatus: 'failure', failedChecks: ['lint'], reviewDecision: 'approved', approvals: 1, commentCount: 2 });
    expect(events.at(-1)!.changes).toEqual(['checks_failed', 'approved', 'new_comments']);

    // New commits: CI starts again on the new head.
    pull.sha = 'sha2';
    pull.checkRuns = [{ name: 'build', status: 'queued', conclusion: null }];
    pull.statuses = [];
    await app.get(PullRequestsService).refresh(first.id);
    expect(events.at(-1)!.changes).toEqual(['new_commits', 'checks_started']);

    pull.state = 'closed';
    pull.merged = true;
    const merged = await app.get(PullRequestsService).refresh(first.id);
    expect(events.at(-1)!.changes).toEqual(['merged']);
    // Finished: never polled again on its own.
    expect(merged.nextFetchAt).toBeNull();
  });

  it('notices pull request links in tasks and comments and lists them per task', async () => {
    const task = (
      await api('post', '/tasks/tasks')
        .send({ name: 'Ship search', description: 'Tracking https://github.com/acme/api/pull/7 here' })
        .expect(201)
    ).body;
    await api('post', `/tasks/tasks/${task.id}/artefacts`).send({ name: 'PR', link: 'https://github.com/acme/api/pull/7' }).expect(201);
    await api('post', `/tasks/tasks/${task.id}/comments`).send({ content: 'Also https://github.com/acme/api/pull/8' }).expect(201);

    // Links are recorded by event listeners, just after the writes return.
    await eventually(async () => {
      const listed = await app.get(PullRequestsService).listForTasks([task.id]);
      expect(listed.map((pr) => pr.key)).toEqual(['acme/api#7', 'acme/api#8']);
    });

    // New links are read soon: the poller picks them up.
    await pollDue();
    const [seven] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#7'] }).expect(200)).body;
    expect(seven.title).toBe('Add search');
    const [eight] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#8'] }).expect(200)).body;
    expect(eight.lastError).toContain('does not exist');

    // Editing the description drops links it no longer has.
    await api('patch', `/tasks/tasks/${task.id}`).send({ description: 'No links now' }).expect(200);
    await eventually(async () => {
      const references: Array<{ source_type: string }> = await ds.query(
        `SELECT source_type FROM pull_request_references WHERE task_id = $1 ORDER BY source_type`,
        [task.id],
      );
      expect(references.map((r) => r.source_type)).toEqual(['task_artefact', 'task_comment']);
    });
  });

  it('reads pull requests on a GitHub Enterprise through its own API, and leaves unknown hosts out', async () => {
    const host = new URL(github.url).host;
    const dotcomRoutes = pullRequestRoutes('acme', 'api', 7, () => pull);
    github.routes = [
      (req) =>
        req.method === 'GET' && req.path === '/api/v3/user' && req.authorization === 'Bearer ghes'
          ? { status: 200, body: { login: 'corp-bot' } }
          : undefined,
      // The same pull request, served under GitHub Enterprise Server's /api/v3.
      (req) =>
        req.path.startsWith('/api/v3/') && req.authorization === 'Bearer ghes'
          ? dotcomRoutes({ ...req, path: req.path.slice('/api/v3'.length) })
          : undefined,
    ];
    const work = (
      await api('post', '/integrations/github/connections')
        .send({ name: 'Work', authType: 'pat', secret: 'ghes', baseUrl: github.url })
        .expect(201)
    ).body;

    // Before the connection is known, the link is not GitHub's: nothing is recorded.
    const task = (
      await api('post', '/tasks/tasks')
        .send({ name: 'Ship it', description: `Tracking ${github.url}/acme/api/pull/7 and https://other.example/a/b/pull/1` })
        .expect(201)
    ).body;
    await eventually(async () => {
      const listed = await app.get(PullRequestsService).listForTasks([task.id]);
      expect(listed.map((pr) => pr.key)).toEqual([`${host}/acme/api#7`]);
    });

    const found = (
      await api('post', '/pull-requests/lookup')
        .send({ refs: [`${host}/acme/api#7`, 'https://other.example/a/b/pull/1'] })
        .expect(200)
    ).body;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ key: `${host}/acme/api#7`, host, title: 'Add search', state: 'open', lastError: null });
    expect(found[0].url).toBe(`https://${host}/acme/api/pull/7`);
    expect(github.requests.filter((r) => r.path.includes('/repos/')).every((r) => r.path.startsWith('/api/v3/repos/'))).toBe(true);

    // github.com's copy of acme/api#7 is a different pull request.
    const [dotcom] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#7'] }).expect(200)).body;
    expect(dotcom.id).not.toBe(found[0].id);

    // A webhook on the Enterprise acme/api covers that repository, not github.com's acme/api.
    const { secret } = (await api('get', `/integrations/github/connections/${work.id}/webhook`).expect(200)).body;
    const ping = JSON.stringify({ zen: 'Hi.', repository: { name: 'api', owner: { login: 'acme' } } });
    await request(http)
      .post(`/api/v1/integrations/github/webhooks/${work.id}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'ping')
      .set('X-GitHub-Hook-Installation-Target-Type', 'repository')
      .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', secret).update(ping).digest('hex')}`)
      .send(ping)
      .expect(202);
    const resolveWebhook = async (repoUrl: string) =>
      (await api('get', '/integrations/github/connections/resolve').query({ repoUrl }).expect(200)).body.webhook;
    expect(await resolveWebhook(`${github.url}/acme/api`)).toMatchObject({ owner: 'acme', repo: 'api', active: true });
    expect(await resolveWebhook('https://github.com/acme/api')).toBeNull();
  });

  it('reads due pull requests on the poll and leaves the rest alone', async () => {
    const [pr] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#7'] }).expect(200)).body;
    pull.title = 'Add search, take two';
    await ds.query(`UPDATE pull_requests SET next_fetch_at = NULL WHERE id = $1`, [pr.id]);
    expect(await pollDue()).toBe(0);

    await ds.query(`UPDATE pull_requests SET next_fetch_at = now() - interval '1 second' WHERE id = $1`, [pr.id]);
    expect(await pollDue()).toBe(1);
    const after = (await api('get', `/pull-requests/${pr.id}`).expect(200)).body;
    expect(after.title).toBe('Add search, take two');
  });

  it('accepts only correctly signed webhooks, which mark pull requests for a fresh look', async () => {
    const connection = (
      await api('post', '/integrations/github/connections').send({ name: 'Acme', authType: 'pat', secret: 'token' }).expect(201)
    ).body;
    const settings = (await api('get', `/integrations/github/connections/${connection.id}/webhook`).expect(200)).body;
    expect(settings.url).toMatch(new RegExp(`/api/v1/integrations/github/webhooks/${connection.id}$`));
    expect(settings.secret).toHaveLength(64);
    // Asking again returns the same secret.
    expect((await api('get', `/integrations/github/connections/${connection.id}/webhook`).expect(200)).body.secret).toBe(settings.secret);

    const [pr] = (await api('post', '/pull-requests/lookup').send({ refs: ['acme/api#7'] }).expect(200)).body;
    await ds.query(`UPDATE pull_requests SET next_fetch_at = NULL WHERE id = $1`, [pr.id]);

    const body = JSON.stringify({ repository: { name: 'api', owner: { login: 'acme' } }, sha: 'sha1' });
    const deliver = (signature: string | null) => {
      const req = request(http)
        .post(`/api/v1/integrations/github/webhooks/${connection.id}`)
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'status');
      if (signature) req.set('X-Hub-Signature-256', signature);
      return req.send(body);
    };

    await deliver(null).expect(401);
    await deliver(`sha256=${createHmac('sha256', 'wrong').update(body).digest('hex')}`).expect(401);
    const [{ next_fetch_at: untouched }] = await ds.query(`SELECT next_fetch_at FROM pull_requests WHERE id = $1`, [pr.id]);
    expect(untouched).toBeNull();

    await deliver(`sha256=${createHmac('sha256', settings.secret).update(body).digest('hex')}`).expect(202);
    const [{ next_fetch_at: marked }] = await ds.query(`SELECT next_fetch_at FROM pull_requests WHERE id = $1`, [pr.id]);
    expect(marked).not.toBeNull();
    const after = (await api('get', `/integrations/github/connections/${connection.id}`).expect(200)).body;
    expect(after.lastWebhookAt).not.toBeNull();
  });

  it('slows polling only for repositories a webhook covers, and learns them from the deliveries', async () => {
    const web = { ...openPull(), title: 'Fix header' };
    github.routes.push(pullRequestRoutes('acme', 'web', 3, () => web));
    const connection = (
      await api('post', '/integrations/github/connections').send({ name: 'Acme', authType: 'pat', secret: 'token', owners: ['acme'] }).expect(201)
    ).body;
    const { secret } = (await api('get', `/integrations/github/connections/${connection.id}/webhook`).expect(200)).body;
    const deliver = (event: string, targetType: string, payload: unknown) => {
      const body = JSON.stringify(payload);
      return request(http)
        .post(`/api/v1/integrations/github/webhooks/${connection.id}`)
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', event)
        .set('X-GitHub-Hook-Installation-Target-Type', targetType)
        .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`)
        .send(body)
        .expect(202);
    };
    /** Minutes until the next look, after a look by someone who has it on screen. */
    const minutesToNextLook = async (ref: string): Promise<number> => {
      const [pr] = (await api('post', '/pull-requests/lookup').send({ refs: [ref] }).expect(200)).body;
      await app.get(PullRequestsService).refresh(pr.id);
      const [{ next_fetch_at }] = await ds.query(`SELECT next_fetch_at FROM pull_requests WHERE id = $1`, [pr.id]);
      return Math.round((new Date(next_fetch_at).getTime() - Date.now()) / 60_000);
    };
    const resolveWebhook = async (repoUrl: string) =>
      (await api('get', '/integrations/github/connections/resolve').query({ repoUrl }).expect(200)).body.webhook;

    // A repository webhook: GitHub pings it as soon as it is saved.
    await deliver('ping', 'repository', { zen: 'Keep it simple.', repository: { name: 'api', owner: { login: 'acme' } } });
    expect(await minutesToNextLook('acme/api#7')).toBe(10);
    expect(await minutesToNextLook('acme/web#3')).toBe(1);
    expect(await resolveWebhook('https://github.com/acme/api')).toMatchObject({ owner: 'acme', repo: 'api', lastEvent: 'ping', active: true });
    expect(await resolveWebhook('https://github.com/acme/web')).toBeNull();

    // An organization webhook covers every repository of the organization.
    await deliver('ping', 'organization', { zen: 'Hi.', organization: { login: 'acme' } });
    expect(await minutesToNextLook('acme/web#3')).toBe(10);
    expect(await resolveWebhook('https://github.com/acme/web')).toMatchObject({ owner: 'acme', repo: null, active: true });

    const settings = (await api('get', `/integrations/github/connections/${connection.id}/webhook`).expect(200)).body;
    expect(settings.sources).toEqual([
      expect.objectContaining({ owner: 'acme', repo: null, lastEvent: 'ping', active: true }),
      expect.objectContaining({ owner: 'acme', repo: 'api', lastEvent: 'ping', active: true }),
    ]);

    // A webhook that has been quiet for over a day is no longer counted on.
    await ds.query(`UPDATE github_webhook_sources SET last_delivery_at = now() - interval '25 hours'`);
    expect(await minutesToNextLook('acme/api#7')).toBe(1);
  });
});
