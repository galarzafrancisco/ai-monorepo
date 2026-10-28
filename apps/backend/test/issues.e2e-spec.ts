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
import { IssuesService } from '../src/issues/issues.service';
import { IssueUpdatedEvent } from '../src/issues/events/issues.events';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { FakeGithub, FakeIssue, issueRoutes, patUsers } from './helpers/fake-github';

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

describe('Issues E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let ds: DataSource;
  let cookies: string;
  const github = new FakeGithub();
  const events: IssueUpdatedEvent[] = [];

  const api = (method: 'post' | 'patch' | 'get' | 'delete', path: string) =>
    request(http)[method](`/api/v1${path}`).set('Cookie', cookies);

  let issue: FakeIssue;
  const openIssue = (): FakeIssue => ({
    title: 'Search is slow',
    state: 'open',
    stateReason: null,
    comments: 1,
    labels: [{ name: 'bug', color: 'D73A4A' }],
    assignees: [],
  });

  const pollDue = () => app.get(IssuesService).fetchDue(50);

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
    app.get(EventEmitter2).on(IssueUpdatedEvent.INTERNAL, (event: IssueUpdatedEvent) => events.push(event));
  }, 30000);

  beforeEach(async () => {
    github.reset();
    events.length = 0;
    issue = openIssue();
    await ds.query(`DELETE FROM issue_references`);
    await ds.query(`DELETE FROM issues`);
    await ds.query(`UPDATE projects SET github_connection_id = NULL`);
    await ds.query(`DELETE FROM github_connections`);
    github.routes = [patUsers({ token: 'acme-bot' }), issueRoutes('acme', 'api', 5, () => issue)];
  });

  afterAll(async () => {
    await app.close();
    await github.stop();
    delete process.env.GITHUB_API_URL;
  });

  it('reads an issue the first time it is looked up', async () => {
    const [found] = (
      await api('post', '/issues/lookup').send({ refs: ['https://github.com/Acme/API/issues/5#issuecomment-1'] }).expect(200)
    ).body;

    expect(found).toMatchObject({
      key: 'acme/api#5',
      host: 'github.com',
      // As it was linked: the key ignores case, GitHub does too.
      owner: 'Acme',
      repo: 'API',
      number: 5,
      url: 'https://github.com/Acme/API/issues/5',
      title: 'Search is slow',
      state: 'open',
      stateReason: null,
      isPullRequest: false,
      authorLogin: 'octocat',
      labels: [{ name: 'bug', color: 'd73a4a' }],
      assignees: [],
      milestone: 'v1',
      commentCount: 1,
      lastError: null,
    });
    // Anonymous: no connection exists.
    expect(github.requests.every((r) => r.authorization === null)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].changes).toEqual([]);

    await api('post', '/issues/lookup').send({ refs: ['nope'] }).expect(400);
  });

  it('uses the matching connection, reuses unchanged answers and reports what changed', async () => {
    await api('post', '/integrations/github/connections').send({ name: 'Acme', authType: 'pat', secret: 'token', owners: ['acme'] }).expect(201);
    const [first] = (await api('post', '/issues/lookup').send({ refs: ['acme/api#5'] }).expect(200)).body;
    expect(github.requests.filter((r) => r.path.startsWith('/repos')).every((r) => r.authorization === 'Bearer token')).toBe(true);

    // Nothing changed: GitHub answers 304 and nothing is emitted.
    github.requests.length = 0;
    events.length = 0;
    await app.get(IssuesService).refresh(first.id);
    const repoRequests = github.requests.filter((r) => r.path.startsWith('/repos'));
    expect(repoRequests).toHaveLength(1);
    expect(repoRequests[0].ifNoneMatch).toBeTruthy();
    expect(events).toHaveLength(0);

    issue.assignees = ['hubot'];
    issue.comments = 2;
    const assigned = (await api('post', `/issues/${first.id}/refresh`).expect(200)).body;
    expect(assigned).toMatchObject({ assignees: ['hubot'], commentCount: 2 });
    expect(events.at(-1)!.changes).toEqual(['assigned', 'new_comments']);

    issue.state = 'closed';
    issue.stateReason = 'not_planned';
    const closed = await app.get(IssuesService).refresh(first.id);
    expect(events.at(-1)!.changes).toEqual(['closed']);
    expect(closed.stateReason).toBe('not_planned');
    // Closed and nobody looking: not polled again on its own.
    await ds.query(`UPDATE issues SET last_viewed_at = NULL WHERE id = $1`, [first.id]);
    expect((await app.get(IssuesService).refresh(first.id)).nextFetchAt).toBeNull();
  });

  it('notices issue links in tasks, comments and threads and lists those attached to a thread', async () => {
    const task = (
      await api('post', '/tasks/tasks')
        .send({ name: 'Fix search', description: 'Reported in https://github.com/acme/api/issues/5' })
        .expect(201)
    ).body;
    await api('post', `/tasks/tasks/${task.id}/artefacts`).send({ name: 'Issue', link: 'https://github.com/acme/api/issues/5' }).expect(201);
    await api('post', `/tasks/tasks/${task.id}/comments`).send({ content: 'Also https://github.com/acme/api/issues/6' }).expect(201);

    // Links are recorded by event listeners, just after the writes return.
    await eventually(async () => {
      const references: Array<{ key: string; source_type: string }> = await ds.query(
        `SELECT i.key, r.source_type FROM issue_references r JOIN issues i ON i.id = r.issue_id
          WHERE r.task_id = $1 ORDER BY i.key, r.source_type`,
        [task.id],
      );
      expect(references).toEqual([
        { key: 'acme/api#5', source_type: 'task_artefact' },
        { key: 'acme/api#5', source_type: 'task_description' },
        { key: 'acme/api#6', source_type: 'task_comment' },
      ]);
    });
    expect((await app.get(IssuesService).listLinkedToTasks([task.id])).map((row) => row.key)).toEqual(['acme/api#5']);

    // New links are read soon: the poller picks them up.
    await pollDue();
    const [five, six] = (await api('post', '/issues/lookup').send({ refs: ['acme/api#5', 'acme/api#6'] }).expect(200)).body;
    expect(five.title).toBe('Search is slow');
    expect(six.lastError).toContain('does not exist');

    // Editing the description drops links it no longer has.
    await api('patch', `/tasks/tasks/${task.id}`).send({ description: 'No links now' }).expect(200);
    await eventually(async () => {
      const references: Array<{ source_type: string }> = await ds.query(
        `SELECT source_type FROM issue_references WHERE task_id = $1 ORDER BY source_type`,
        [task.id],
      );
      expect(references.map((r) => r.source_type)).toEqual(['task_artefact', 'task_comment']);
    });
  });

  it('says when an /issues/ link is really a pull request', async () => {
    issue.pullRequest = true;
    const [found] = (await api('post', '/issues/lookup').send({ refs: ['acme/api#5'] }).expect(200)).body;
    expect(found.isPullRequest).toBe(true);
  });

  it('keeps reading a transferred issue at the address it was linked by', async () => {
    issue.transferredTo = 'acme/web';
    const [found] = (await api('post', '/issues/lookup').send({ refs: ['acme/api#5'] }).expect(200)).body;
    expect(found).toMatchObject({ key: 'acme/api#5', owner: 'acme', repo: 'api', number: 5, title: 'Search is slow' });

    github.requests.length = 0;
    await app.get(IssuesService).refresh(found.id);
    expect(github.requests.filter((r) => r.path.startsWith('/repos')).map((r) => r.path)).toEqual(['/repos/acme/api/issues/5']);
  });

  it('leaves out issues on hosts Taico has no connection to', async () => {
    const found = (await api('post', '/issues/lookup').send({ refs: ['https://other.example/a/b/issues/1'] }).expect(200)).body;
    expect(found).toEqual([]);
  });

  it('marks issues for a fresh look when a signed issues or issue_comment webhook arrives', async () => {
    const connection = (
      await api('post', '/integrations/github/connections').send({ name: 'Acme', authType: 'pat', secret: 'token' }).expect(201)
    ).body;
    const { secret } = (await api('get', `/integrations/github/connections/${connection.id}/webhook`).expect(200)).body;
    const [found] = (await api('post', '/issues/lookup').send({ refs: ['acme/api#5'] }).expect(200)).body;
    const nextFetchAt = async () =>
      (await ds.query(`SELECT next_fetch_at FROM issues WHERE id = $1`, [found.id]))[0].next_fetch_at;

    const deliver = (event: string, signingSecret: string) => {
      const body = JSON.stringify({ action: 'closed', repository: { name: 'api', owner: { login: 'acme' } }, issue: { number: 5 } });
      return request(http)
        .post(`/api/v1/integrations/github/webhooks/${connection.id}`)
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', event)
        .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', signingSecret).update(body).digest('hex')}`)
        .send(body);
    };

    await ds.query(`UPDATE issues SET next_fetch_at = NULL WHERE id = $1`, [found.id]);
    await deliver('issues', 'wrong').expect(401);
    expect(await nextFetchAt()).toBeNull();
    await deliver('issues', secret).expect(202);
    expect(await nextFetchAt()).not.toBeNull();

    await ds.query(`UPDATE issues SET next_fetch_at = NULL WHERE id = $1`, [found.id]);
    await deliver('issue_comment', secret).expect(202);
    expect(await nextFetchAt()).not.toBeNull();

    issue.state = 'closed';
    issue.stateReason = 'completed';
    expect(await pollDue()).toBe(1);
    expect((await api('get', `/issues/${found.id}`).expect(200)).body).toMatchObject({ state: 'closed', stateReason: 'completed' });
  });
});
