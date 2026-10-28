import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { createHmac } from 'node:crypto';

export type FakeGithubRequest = {
  method: string;
  path: string;
  authorization: string | null;
  ifNoneMatch: string | null;
  body: unknown;
};

export type FakeGithubReply = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

export type FakeGithubRoute = (request: FakeGithubRequest) => FakeGithubReply | undefined;

/**
 * A stand-in for api.github.com. Each test sets `routes`: the first route that
 * returns a reply answers; unmatched requests get 404 like GitHub would.
 * Every request is recorded in `requests`.
 */
export class FakeGithub {
  readonly requests: FakeGithubRequest[] = [];
  routes: FakeGithubRoute[] = [];
  private server!: Server;
  url = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  reset(): void {
    this.requests.length = 0;
    this.routes = [];
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    const request: FakeGithubRequest = {
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      authorization: req.headers.authorization ?? null,
      ifNoneMatch: (req.headers['if-none-match'] as string | undefined) ?? null,
      body: raw ? JSON.parse(raw) : null,
    };
    this.requests.push(request);

    const reply = this.routes.map((route) => route(request)).find(Boolean) ?? {
      status: 404,
      body: { message: 'Not Found' },
    };
    res.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    res.end(reply.body === undefined ? '' : JSON.stringify(reply.body));
  }
}

/** Answers GET /user for the given tokens, and 401 Bad credentials for any other. */
export function patUsers(logins: Record<string, string>): FakeGithubRoute {
  return (request) => {
    if (request.method !== 'GET' || request.path !== '/user') return undefined;
    const token = request.authorization?.replace(/^Bearer /, '') ?? '';
    const login = logins[token];
    return login
      ? { status: 200, body: { login } }
      : { status: 401, body: { message: 'Bad credentials' } };
  };
}

export type FakePull = {
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  sha: string;
  comments: number;
  checkRuns: Array<{ name: string; status: string; conclusion: string | null }>;
  statuses: Array<{ context: string; state: string }>;
  reviews: Array<{ user: { login: string }; state: string }>;
};

/** Serves one pull request the way GitHub does, with ETags and 304s. */
export function pullRequestRoutes(owner: string, repo: string, number: number, pull: () => FakePull): FakeGithubRoute {
  const base = `/repos/${owner}/${repo}`;
  const reply = (body: unknown, ifNoneMatch: string | null) => {
    const etag = `"${createHmac('sha1', 'etag').update(JSON.stringify(body)).digest('hex')}"`;
    return ifNoneMatch === etag ? { status: 304, headers: { etag } } : { status: 200, body, headers: { etag } };
  };
  return (incoming) => {
    const pr = pull();
    // GitHub ignores the case of owners and repositories.
    const req = { ...incoming, path: incoming.path.toLowerCase() };
    if (req.method !== 'GET') return undefined;
    if (req.path === `${base}/pulls/${number}`) {
      return reply(
        {
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          merged: pr.merged,
          merged_at: pr.merged ? '2026-01-02T00:00:00Z' : null,
          closed_at: pr.state === 'closed' ? '2026-01-02T00:00:00Z' : null,
          updated_at: '2026-01-01T00:00:00Z',
          user: { login: 'octocat' },
          head: { sha: pr.sha, ref: 'feature' },
          base: { ref: 'main', repo: { name: repo, owner: { login: owner } } },
          additions: 123,
          deletions: 32,
          changed_files: 4,
          comments: pr.comments,
          review_comments: 0,
        },
        req.ifNoneMatch,
      );
    }
    if (req.path === `${base}/commits/${pr.sha}/check-runs?per_page=100`) {
      return reply({ check_runs: pr.checkRuns }, req.ifNoneMatch);
    }
    if (req.path === `${base}/commits/${pr.sha}/status?per_page=100`) {
      return reply({ statuses: pr.statuses }, req.ifNoneMatch);
    }
    if (req.path === `${base}/pulls/${number}/reviews?per_page=100`) {
      return reply(pr.reviews, req.ifNoneMatch);
    }
    return undefined;
  };
}

/** An open pull request with CI running, no reviews and one comment. */
export function openFakePull(): FakePull {
  return {
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
  };
}

export type FakeIssue = {
  title: string;
  state: 'open' | 'closed';
  stateReason: string | null;
  comments: number;
  labels: Array<{ name: string; color: string }>;
  assignees: string[];
  /** GitHub serves pull requests at /issues/:n too, with a `pull_request` key. */
  pullRequest?: boolean;
  /** `owner/repo` it was moved to: GitHub answers the old address from there. */
  transferredTo?: string;
};

/** Serves one issue the way GitHub does, with ETags and 304s. */
export function issueRoutes(owner: string, repo: string, number: number, issue: () => FakeIssue): FakeGithubRoute {
  return (incoming) => {
    // GitHub ignores the case of owners and repositories.
    if (incoming.method !== 'GET' || incoming.path.toLowerCase() !== `/repos/${owner}/${repo}/issues/${number}`) return undefined;
    const current = issue();
    const body = {
      title: current.title,
      state: current.state,
      state_reason: current.stateReason,
      user: { login: 'octocat' },
      labels: current.labels,
      assignees: current.assignees.map((login) => ({ login })),
      milestone: { title: 'v1' },
      comments: current.comments,
      closed_at: current.state === 'closed' ? '2026-01-02T00:00:00Z' : null,
      updated_at: '2026-01-01T00:00:00Z',
      repository_url: `https://api.github.com/repos/${current.transferredTo ?? `${owner}/${repo}`}`,
      ...(current.pullRequest ? { pull_request: { url: 'x' } } : {}),
    };
    const etag = `"${createHmac('sha1', 'etag').update(JSON.stringify(body)).digest('hex')}"`;
    return incoming.ifNoneMatch === etag ? { status: 304, headers: { etag } } : { status: 200, body, headers: { etag } };
  };
}
