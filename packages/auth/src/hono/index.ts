import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { buildChallenge } from '../core/challenge.js';
import { AuthError } from '../core/errors.js';
import {
  createAuthHttpHandler,
  type AuthHttpOptions,
  type HttpResponse,
} from '../core/http.js';
import type { OAuthServer } from '../core/oauth-server.js';
import type { ProtectedResource, ResourceRegistry } from '../core/ports.js';
import {
  assertScopes,
  buildProtectedResourceMetadata,
  findResourceByPath,
  PROTECTED_RESOURCE_METADATA_PATH,
  type ResourceServer,
} from '../core/resource-server.js';
import { toRequiredScopes, type RequiredScopes } from '../core/scopes.js';
import type { AuthContext } from '../core/types.js';

/** Hono variables set by `bearerAuth`: read with `c.get('auth')` */
export type AuthVariables = { auth: AuthContext };

function challengeResponse(
  c: Context,
  error: AuthError,
  header: string,
  status: 401 | 403,
): Response {
  c.header('www-authenticate', header);
  return c.json(
    { error: error.code.toLowerCase(), error_description: error.message },
    status,
  );
}

/**
 * Requires a valid access token. Puts the `AuthContext` in `c.get('auth')`,
 * or answers 401 with a Bearer challenge.
 */
export function bearerAuth(auth: ResourceServer): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    try {
      c.set(
        'auth',
        await auth.authenticate(
          {
            authorization: c.req.header('authorization'),
            cookie: c.req.header('cookie'),
          },
          auth.requestUrl(url.pathname, url.origin),
        ),
      );
    } catch (error) {
      const challenge = auth.challenge(
        error,
        `${auth.requestUrl(PROTECTED_RESOURCE_METADATA_PATH, url.origin)}${url.pathname}`,
      );
      if (!(error instanceof AuthError) || !challenge) {
        throw error;
      }
      return challengeResponse(c, error, challenge.header, challenge.status);
    }
    await next();
  };
}

/** Requires scopes on the token `bearerAuth` accepted */
export function requireScopes(
  ...scopes: string[] | [Partial<RequiredScopes>]
): MiddlewareHandler<{ Variables: AuthVariables }> {
  const required = toRequiredScopes(scopes);
  return async (c, next) => {
    try {
      assertScopes(c.get('auth'), required);
    } catch (error) {
      const challenge = error instanceof AuthError ? buildChallenge(error) : null;
      if (!(error instanceof AuthError) || !challenge) {
        throw error;
      }
      return challengeResponse(c, error, challenge.header, challenge.status);
    }
    await next();
  };
}

/** Serves RFC 9728 protected resource metadata. Mount at the root of the app. */
export function protectedResourceMetadata(
  resources: ResourceRegistry | ProtectedResource[],
  options: { authorizationServers: string[] },
): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (c.req.method !== 'GET' || !path.startsWith(PROTECTED_RESOURCE_METADATA_PATH)) {
      return next();
    }
    const resource = await findResourceByPath(
      resources,
      path.slice(PROTECTED_RESOURCE_METADATA_PATH.length) || '/',
    );
    if (!resource) {
      return next();
    }
    c.header('cache-control', 'public, max-age=300');
    return c.json(
      buildProtectedResourceMetadata(resource, options.authorizationServers),
    );
  };
}

function toResponse(result: HttpResponse): Response {
  const headers = new Headers(result.headers);
  for (const cookie of result.cookies ?? []) {
    headers.append('set-cookie', cookie);
  }
  if (result.body === undefined) {
    return new Response(null, { status: result.status, headers });
  }
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return {};
  }
  const raw = await request.text();
  if (!raw) {
    return {};
  }
  if (/json/i.test(request.headers.get('content-type') ?? '')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

/**
 * Every endpoint of the authorization server as a Hono middleware.
 * Requests for other routes fall through to the rest of the app.
 */
export function authRoutes(
  server: OAuthServer,
  options: AuthHttpOptions = {},
): MiddlewareHandler {
  const handle = createAuthHttpHandler(server, options);
  return async (c, next) => {
    const url = new URL(c.req.url);
    if (!handle.matches(c.req.method, url.pathname)) {
      return next();
    }
    const result = await handle({
      method: c.req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(c.req.raw.headers),
      body: await bodyOf(c.req.raw),
    });
    return toResponse(result!);
  };
}

/** The authorization server as a standalone Hono app: `app.route('/', authApp(server))` */
export function authApp(server: OAuthServer, options: AuthHttpOptions = {}): Hono {
  const app = new Hono();
  app.use('*', authRoutes(server, options));
  return app;
}
