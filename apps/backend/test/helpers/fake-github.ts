import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

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
