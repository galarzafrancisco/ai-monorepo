import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { PullRequestsService } from '../src/pull-requests/pull-requests.service';
import { ThreadWatchExpiryService } from '../src/threads/watches/thread-watch-expiry.service';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { FakeGithub, FakePull, openFakePull, pullRequestRoutes } from './helpers/fake-github';

type PromptMessage = { role: string; content: unknown };
type ToolCall = { toolName: string; input: Record<string, unknown> };
type ModelStep = { text: string } | { toolCalls: ToolCall[] };

const PR_URL = 'https://github.com/acme/api/pull/7';

describe('Thread pull request watches E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let cookies: string;
  let ds: DataSource;
  const github = new FakeGithub();
  let pull: FakePull;

  const prompts: PromptMessage[][] = [];
  const script: ModelStep[] = [];
  const toolResults: unknown[] = [];
  let callCount = 0;

  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  };

  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Thread title' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
    doStream: async (options) => {
      const prompt = options.prompt as PromptMessage[];
      prompts.push(prompt);
      const last = prompt[prompt.length - 1];
      if (last?.role === 'tool') toolResults.push(last.content);
      const call = ++callCount;
      const step = script.shift() ?? { text: `Reply ${call}` };
      const chunks =
        'text' in step
          ? [
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: step.text },
              { type: 'text-end' as const, id: 't' },
              { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage },
            ]
          : [
              ...step.toolCalls.map((toolCall, index) => ({
                type: 'tool-call' as const,
                toolCallId: `call-${call}-${index}`,
                toolName: toolCall.toolName,
                input: JSON.stringify(toolCall.input),
              })),
              { type: 'finish' as const, finishReason: { unified: 'tool-calls' as const, raw: undefined }, usage },
            ];
      return { stream: simulateReadableStream({ chunks }) };
    },
  });

  const api = (method: 'post' | 'patch' | 'get' | 'delete', path: string) =>
    request(http)[method](`/api/v1${path}`).set('Cookie', cookies);

  const createThread = async (): Promise<string> =>
    (await api('post', '/threads').send({ title: 'Watching a PR' }).expect(201)).body.id;

  const sendMessage = (threadId: string, content: string) =>
    api('post', `/threads/${threadId}/messages`).send({ content }).expect(201);

  const waitForTurns = async (threadId: string, count: number): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const turns: Array<{ status: string }> = await ds.query(`SELECT status FROM thread_turns WHERE thread_id = $1`, [
        threadId,
      ]);
      if (turns.length >= count && turns.every((turn) => turn.status !== 'running')) {
        expect(turns.map((turn) => turn.status)).toEqual(turns.map(() => 'completed'));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${count} agent turns`);
  };

  const notifications = async (threadId: string): Promise<string[]> => {
    const rows: Array<{ message: { content: string } }> = await ds.query(
      `SELECT message FROM thread_agent_messages
        WHERE thread_id = $1 AND source = 'watch:pull_request' AND kind = 'injection'
        ORDER BY created_at ASC`,
      [threadId],
    );
    return rows.map((row) => row.message.content);
  };

  const watches = async (threadId: string) => (await api('get', `/threads/${threadId}`).expect(200)).body.watches;

  const pullRequestRow = async () =>
    (await ds.query(`SELECT id, watched_until, next_fetch_at FROM pull_requests WHERE key = 'acme/api#7'`))[0];

  const refreshPullRequest = async () => {
    const row = await pullRequestRow();
    await app.get(PullRequestsService).refresh(row.id);
  };

  /** A thread whose agent started watching the pull request while answering the user. */
  const threadWatching = async (input: Record<string, unknown>): Promise<string> => {
    const threadId = await createThread();
    script.push(
      {
        toolCalls: [
          {
            toolName: 'watch_pull_request',
            input: { pullRequest: PR_URL, waitingFor: 'The user wants to merge once CI is green.', ...input },
          },
        ],
      },
      { text: 'I will keep an eye on it.' },
    );
    await sendMessage(threadId, `watch ${PR_URL}`);
    await waitForTurns(threadId, 1);
    return threadId;
  };

  beforeAll(async () => {
    await github.start();
    process.env.GITHUB_API_URL = github.url;

    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ChatModelFactory)
      .useValue({ resolve: async () => ({ model, providerType: 'mock', modelId: 'mock-model-id' }) })
      .overrideProvider(TaicoMcpToolsFactory)
      .useValue({ open: async () => ({ tools: {}, close: async () => undefined }) })
      .compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(http);
  }, 30000);

  beforeEach(async () => {
    github.reset();
    pull = openFakePull();
    github.routes = [pullRequestRoutes('acme', 'api', 7, () => pull)];
    toolResults.length = 0;
    await ds.query(`DELETE FROM pull_request_references`);
    await ds.query(`DELETE FROM pull_requests`);
    // Connections left by other suites hold secrets encrypted with their own key.
    await ds.query(`UPDATE projects SET github_connection_id = NULL`);
    await ds.query(`DELETE FROM github_connections`);
  });

  afterEach(() => {
    expect(script).toEqual([]);
  });

  afterAll(async () => {
    await app.close();
    await github.stop();
    delete process.env.GITHUB_API_URL;
  });

  it('wakes the agent when CI finishes, then stops watching', async () => {
    const threadId = await threadWatching({ for: ['checks_finished'] });

    // The tool answered with the current state.
    expect(JSON.stringify(toolResults[0])).toContain('Watching acme/api#7 for checks_finished');
    expect(JSON.stringify(toolResults[0])).toContain('CI running');

    const [watch] = await watches(threadId);
    expect(watch).toMatchObject({
      kind: 'pull_request',
      targetLabel: 'acme/api#7',
      targetUrl: PR_URL,
      conditions: ['checks_finished'],
      once: true,
      waitingFor: 'The user wants to merge once CI is green.',
    });
    // Watched pull requests are polled often.
    expect((await pullRequestRow()).watched_until).not.toBeNull();

    // Comments alone do not wake the agent.
    pull.comments = 5;
    await refreshPullRequest();
    expect(await notifications(threadId)).toEqual([]);

    script.push({ text: 'CI failed on lint, so it cannot be merged yet.' });
    pull.checkRuns[1] = { name: 'lint', status: 'completed', conclusion: 'failure' };
    await refreshPullRequest();
    await waitForTurns(threadId, 2);

    const [notification] = await notifications(threadId);
    expect(notification).toContain('<watch-notification kind="pull_request"');
    expect(notification).toContain('Pull request acme/api#7 "Add search" failed CI (lint).');
    expect(notification).toContain('You are watching it because: The user wants to merge once CI is green.');
    expect(notification).toContain('You are no longer watching it.');
    // Sent to the model with the thread key, and stored without it.
    const lastPrompt = prompts[prompts.length - 1];
    expect(JSON.stringify(lastPrompt[lastPrompt.length - 1])).toMatch(/<watch-notification key=\\"[0-9a-f]{6}\\"/);
    expect(notification).not.toContain('key=');

    expect(await watches(threadId)).toEqual([]);
    expect((await pullRequestRow()).watched_until).toBeNull();
  });

  it('keeps watching across notifications and always ends on merge', async () => {
    const threadId = await threadWatching({ for: ['approved'], once: false });

    script.push({ text: 'It was approved.' });
    pull.reviews = [{ user: { login: 'reviewer' }, state: 'APPROVED' }];
    await refreshPullRequest();
    await waitForTurns(threadId, 2);
    expect(await watches(threadId)).toHaveLength(1);

    script.push({ text: 'It is merged.' });
    pull.state = 'closed';
    pull.merged = true;
    await refreshPullRequest();
    await waitForTurns(threadId, 3);

    const delivered = await notifications(threadId);
    expect(delivered).toHaveLength(2);
    expect(delivered[0]).toContain('was approved');
    expect(delivered[0]).toContain('You are still watching it');
    expect(delivered[1]).toContain('was merged');
    expect(delivered[1]).toContain('final="true"');
    expect(await watches(threadId)).toEqual([]);
  });

  it('does not watch a pull request that is already merged', async () => {
    pull.state = 'closed';
    pull.merged = true;
    const threadId = await threadWatching({ for: ['checks_finished'] });
    expect(JSON.stringify(toolResults[0])).toContain('It is already merged');
    expect(await watches(threadId)).toEqual([]);
  });

  it('can be stopped from the UI, and expires with a last notification', async () => {
    const stopped = await threadWatching({ for: ['merged'] });
    const [watch] = await watches(stopped);
    await api('delete', `/threads/${stopped}/watches/${watch.id}`).expect(204);
    await api('delete', `/threads/${stopped}/watches/${watch.id}`).expect(204);
    expect(await watches(stopped)).toEqual([]);
    expect((await pullRequestRow()).watched_until).toBeNull();

    const expiring = await threadWatching({ for: ['merged'] });
    await ds.query(`UPDATE thread_watches SET expires_at = now() - interval '1 minute' WHERE thread_id = $1`, [expiring]);
    script.push({ text: 'I stopped watching it.' });
    await app.get(ThreadWatchExpiryService).sweep();
    await waitForTurns(expiring, 2);
    const [expired] = await notifications(expiring);
    expect(expired).toContain('the watch expired');
    expect(await ds.query(`SELECT 1 FROM thread_watches WHERE thread_id = $1`, [expiring])).toEqual([]);
  });

  it("lists the pull requests attached as links to a thread's tasks, not ones only mentioned", async () => {
    const threadId = await createThread();
    const task = (
      await api('post', '/tasks/tasks').send({ name: 'Ship it', description: 'see https://github.com/acme/api/pull/9' }).expect(201)
    ).body;
    await api('post', `/threads/${threadId}/tasks`).send({ taskId: task.id }).expect(201);
    await api('post', `/tasks/tasks/${task.id}/comments`).send({ content: 'and https://github.com/acme/api/pull/10' }).expect(201);
    await api('post', `/tasks/tasks/${task.id}/artefacts`).send({ name: 'PR', link: PR_URL }).expect(201);
    script.push({ text: 'Noted.' });
    await sendMessage(threadId, 'also see https://github.com/acme/api/pull/8');
    await waitForTurns(threadId, 1);

    // Wait until every link is recorded, so the list below is final.
    for (let attempt = 0; ; attempt++) {
      const [{ count }] = await ds.query(
        `SELECT count(*)::int AS count FROM pull_request_references WHERE task_id = $1 OR thread_id = $2`,
        [task.id, threadId],
      );
      if (count === 4) break;
      if (attempt === 100) throw new Error(`Only ${count} of 4 links were recorded`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const listed = (await api('get', `/threads/${threadId}/pull-requests`).expect(200)).body;
    expect(listed.map((pr: { key: string }) => pr.key)).toEqual(['acme/api#7']);
  });
});
