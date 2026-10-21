import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  bearerTokenFrom,
  buildChallenge,
  parseCookies,
  type ChallengeOptions,
} from './challenge.js';
import {
  AuthError,
  AuthErrorCodes,
  InvalidAccessTokenError,
  MissingAccessTokenError,
  OAuthError,
} from './errors.js';
import type { OAuthServer, SessionTokens } from './oauth-server.js';
import { PROTECTED_RESOURCE_METADATA_PATH } from './resource-server.js';

/*
 * The authorization server's HTTP surface, written once against plain request
 * and response objects. The Express, Hono and Nest adapters only translate
 * to and from these, so all three behave identically.
 */

export type HttpRequest = {
  method: string;
  /** URL path, without query string */
  path: string;
  query: Record<string, string>;
  /** Header names in lower case */
  headers: Record<string, string | undefined>;
  /** Parsed JSON or form body */
  body?: Record<string, unknown>;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  cookies?: string[];
  /** Sent as JSON */
  body?: unknown;
};

export type AuthHttpOptions = {
  /** Cookie names for the browser session. Defaults: access_token, refresh_token. */
  accessTokenCookie?: string;
  refreshTokenCookie?: string;
  /**
   * Origins, besides the issuer's, whose pages may post to the session and
   * consent endpoints (for example a UI served from another port in
   * development). Those POSTs are refused unless their `Origin` header, or
   * their `Referer` when there is no `Origin`, names one of these origins.
   */
  trustedOrigins?: string[];
};

export type AuthHttpHandler = {
  (request: HttpRequest): Promise<HttpResponse | null>;
  /** Whether a request is for one of the handler's routes */
  matches(method: string, path: string): boolean;
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({
    status,
    headers: { 'cache-control': 'no-store', ...headers },
    body,
  }) satisfies HttpResponse;

const redirect = (location: string): HttpResponse => ({
  status: 302,
  headers: { location, 'cache-control': 'no-store' },
});

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Builds the handler for every endpoint of an `OAuthServer`. It returns null
 * for requests that are not for it, so it can sit in front of other routes.
 */
export function createAuthHttpHandler(
  server: OAuthServer,
  options: AuthHttpOptions = {},
): AuthHttpHandler {
  const { issuer, basePath } = server.config;
  const accessCookie = options.accessTokenCookie ?? 'access_token';
  const refreshCookie = options.refreshTokenCookie ?? 'refresh_token';
  const secure = issuer.startsWith('https://');
  const trustedOrigins = new Set([new URL(issuer).origin, ...(options.trustedOrigins ?? [])]);

  const cookie = (name: string, value: string, maxAgeSeconds: number) =>
    [
      `${name}=${encodeURIComponent(value)}`,
      'Path=/',
      `Max-Age=${maxAgeSeconds}`,
      'HttpOnly',
      // Lax keeps the cookie off cross-site POSTs, which is what protects
      // the consent and session endpoints from request forgery.
      'SameSite=Lax',
      ...(secure ? ['Secure'] : []),
    ].join('; ');

  const sessionCookies = (session: SessionTokens) => [
    cookie(accessCookie, session.accessToken, session.expiresInSeconds),
    cookie(refreshCookie, session.refreshToken, session.refreshExpiresInSeconds),
  ];
  const clearedCookies = [cookie(accessCookie, '', 0), cookie(refreshCookie, '', 0)];

  /**
   * Where a request says it came from: its `Origin`, or failing that the
   * origin of its `Referer`. An `Origin` that is present always decides, so
   * an opaque one (`null`) is never rescued by a Referer.
   */
  const sourceOrigin = (request: HttpRequest): string | undefined => {
    const origin = request.headers.origin?.trim();
    if (origin) {
      return origin;
    }
    const referer = request.headers.referer?.trim();
    if (!referer) {
      return undefined;
    }
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  };

  /**
   * Session POSTs must come from a page we trust. A request that names no
   * source at all is refused: the absence of `Origin` proves nothing.
   */
  const assertTrustedOrigin = (request: HttpRequest) => {
    const origin = sourceOrigin(request);
    if (!origin || !trustedOrigins.has(origin)) {
      throw new OAuthError('invalid_request', 'Request origin is not allowed', 403);
    }
  };

  /** The logged-in user, from the session cookie or a session bearer token */
  const currentSubject = async (request: HttpRequest): Promise<string> => {
    const token =
      bearerTokenFrom(request.headers.authorization) ??
      parseCookies(request.headers.cookie)[accessCookie];
    if (!token) {
      throw new MissingAccessTokenError();
    }
    try {
      return await server.resolveSession(token);
    } catch {
      throw new InvalidAccessTokenError('Not logged in');
    }
  };

  const sessionBody = (session: SessionTokens) => ({
    subject: session.subject,
    expires_in: session.expiresInSeconds,
  });

  type Route = (request: HttpRequest, param: string) => Promise<HttpResponse>;
  const routes: [method: string, pattern: RegExp, handle: Route][] = [];
  const route = (method: string, path: string, handle: Route) => {
    const pattern = path
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:param/, '([^/]+)')
      .replace(/:rest/, '(.*)');
    routes.push([method, new RegExp(`^${pattern}/?$`), handle]);
  };

  // ---- discovery
  route('GET', '/.well-known/oauth-authorization-server:rest', async () =>
    json(server.metadata(), 200, { 'cache-control': 'public, max-age=300' }),
  );
  route('GET', '/.well-known/jwks.json', async () =>
    json(await server.keys.getJwks(), 200, { 'cache-control': 'public, max-age=300' }),
  );
  route('GET', `${PROTECTED_RESOURCE_METADATA_PATH}:rest`, async (_request, rest) => {
    const metadata = await server.protectedResourceMetadata(rest || '/');
    return metadata
      ? json(metadata, 200, { 'cache-control': 'public, max-age=300' })
      : json({ error: 'not_found' }, 404);
  });

  // ---- OAuth
  route('GET', `${basePath}/authorize`, async (request) =>
    redirect((await server.authorize(request.query)).redirectTo),
  );
  route('GET', `${basePath}/consent/:param`, async (_request, grantId) =>
    json(await server.getConsent(grantId)),
  );
  route('POST', `${basePath}/consent`, async (request) => {
    // A bearer header is not sent by the browser on its own, so a request
    // that authenticates with one cannot be forged; the cookie is then unused.
    if (!bearerTokenFrom(request.headers.authorization)) {
      assertTrustedOrigin(request);
    }
    const body = request.body ?? {};
    const grantId = text(body.grant_id);
    if (!grantId) {
      throw new OAuthError('invalid_request', 'grant_id is required');
    }
    const { redirectTo } = await server.decide({
      grantId,
      approved: body.approved === true || body.approved === 'true',
      subjectId: await currentSubject(request),
    });
    // A page that posts JSON navigates itself; a form post is redirected
    return /json/i.test(request.headers['content-type'] ?? '')
      ? json({ redirect_to: redirectTo })
      : { ...redirect(redirectTo), status: 303 };
  });
  route('POST', `${basePath}/token`, async (request) =>
    json(await server.token(request.body ?? {}), 200, { pragma: 'no-cache' }),
  );
  route('POST', `${basePath}/register`, async (request) => {
    const client = await server.register(request.body ?? {});
    return json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: ['code'],
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        scope: client.scopes.join(' '),
      },
      201,
    );
  });
  route('POST', `${basePath}/introspect`, async (request) =>
    json(await server.introspect(request.body ?? {})),
  );
  route('POST', `${basePath}/revoke`, async (request) => {
    await server.revoke(request.body ?? {});
    return json({});
  });

  // ---- browser session
  route('POST', `${basePath}/login`, async (request) => {
    assertTrustedOrigin(request);
    const session = await server.login({
      email: text(request.body?.email) ?? '',
      password: text(request.body?.password) ?? '',
    });
    return { ...json(sessionBody(session)), cookies: sessionCookies(session) };
  });
  route('POST', `${basePath}/session/refresh`, async (request) => {
    assertTrustedOrigin(request);
    const refreshToken = parseCookies(request.headers.cookie)[refreshCookie];
    if (!refreshToken) {
      throw new MissingAccessTokenError();
    }
    const session = await server.refreshSession(refreshToken);
    return { ...json(sessionBody(session)), cookies: sessionCookies(session) };
  });
  route('POST', `${basePath}/logout`, async (request) => {
    assertTrustedOrigin(request);
    await server.logout(parseCookies(request.headers.cookie)[refreshCookie]);
    return { ...json({}), cookies: clearedCookies };
  });
  route('GET', `${basePath}/session`, async (request) =>
    json({ subject_id: await currentSubject(request) }),
  );

  const find = (method: string, path: string) => {
    for (const [routeMethod, pattern, handle] of routes) {
      const match = routeMethod === method.toUpperCase() && pattern.exec(path);
      if (match) {
        return { handle, param: match[1] ? decodeURIComponent(match[1]) : '' };
      }
    }
    return null;
  };

  const handler = async (request: HttpRequest): Promise<HttpResponse | null> => {
    const found = find(request.method, request.path);
    if (!found) {
      return null;
    }
    try {
      return await found.handle(request, found.param);
    } catch (error) {
      return errorResponse(error);
    }
  };
  return Object.assign(handler, {
    matches: (method: string, path: string) => find(method, path) !== null,
  });
}

/** Maps this package's errors to responses. Anything else is rethrown. */
export function errorResponse(
  error: unknown,
  challengeOptions: ChallengeOptions = {},
): HttpResponse {
  if (error instanceof OAuthError) {
    const headers: Record<string, string> =
      error.status === 401 ? { 'www-authenticate': 'Basic realm="oauth"' } : {};
    return json(error.toJSON(), error.status, headers);
  }
  if (error instanceof AuthError) {
    if (error.code === AuthErrorCodes.INVALID_CREDENTIALS) {
      return json({ error: 'invalid_credentials', error_description: error.message }, 401);
    }
    const challenge = buildChallenge(error, challengeOptions);
    if (challenge) {
      return json(
        { error: error.code.toLowerCase(), error_description: error.message },
        challenge.status,
        { 'www-authenticate': challenge.header },
      );
    }
  }
  throw error;
}

// ---------------------------------------------------------------- node adapter

type NodeRequest = IncomingMessage & { body?: unknown; originalUrl?: string };

const MAX_BODY_BYTES = 64 * 1024;

async function readBody(request: NodeRequest): Promise<Record<string, unknown>> {
  // A body parser upstream (express.json, Nest) may already have read it
  if (request.body !== undefined && request.body !== null) {
    return typeof request.body === 'object'
      ? (request.body as Record<string, unknown>)
      : {};
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    return {};
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new OAuthError('invalid_request', 'Request body is too large', 413);
    }
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  if (/json/i.test(request.headers['content-type'] ?? '')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      throw new OAuthError('invalid_request', 'Request body is not valid JSON');
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

/**
 * The handler as a Node `(req, res, next)` function. Works as Express or
 * Connect middleware, as Nest middleware on either platform, and directly
 * with `http.createServer`.
 */
export function createNodeAuthHandler(
  server: OAuthServer,
  options: AuthHttpOptions = {},
): (
  request: NodeRequest,
  response: ServerResponse,
  next?: (error?: unknown) => void,
) => Promise<void> {
  const handle = createAuthHttpHandler(server, options);
  return async (request, response, next) => {
    try {
      const url = new URL(request.originalUrl ?? request.url ?? '/', 'http://localhost');
      const method = request.method ?? 'GET';
      // Leave requests for other routes untouched, body included
      if (!handle.matches(method, url.pathname)) {
        if (next) return next();
        response.statusCode = 404;
        response.end();
        return;
      }

      const headers: Record<string, string | undefined> = {};
      for (const [name, value] of Object.entries(request.headers)) {
        headers[name] = Array.isArray(value) ? value.join(', ') : value;
      }
      let result: HttpResponse | null;
      try {
        result = await handle({
          method,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          headers,
          body: await readBody(request),
        });
      } catch (error) {
        result = errorResponse(error);
      }
      writeNodeResponse(response, result!);
    } catch (error) {
      if (next) return next(error);
      response.statusCode = 500;
      response.end();
    }
  };
}

function writeNodeResponse(response: ServerResponse, result: HttpResponse): void {
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value);
  }
  if (result.cookies?.length) {
    response.setHeader('set-cookie', result.cookies);
  }
  if (result.body === undefined) {
    response.end();
    return;
  }
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(result.body));
}
