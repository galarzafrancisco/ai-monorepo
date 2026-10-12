import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildChallenge } from '../core/challenge.js';
import { AuthError } from '../core/errors.js';
import { createNodeAuthHandler, type AuthHttpOptions } from '../core/http.js';
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

/*
 * Express adapter. Typed against Node's request and response, which Express
 * extends, so this module does not import Express itself.
 */

type Request = IncomingMessage & {
  originalUrl?: string;
  protocol?: string;
  auth?: AuthContext;
};
type Response = ServerResponse & { locals?: Record<string, unknown> };
type Next = (error?: unknown) => void;
export type Middleware = (request: Request, response: Response, next: Next) => void;

const originOf = (request: Request) =>
  `${request.protocol ?? 'http'}://${request.headers.host ?? 'localhost'}`;

const pathOf = (request: Request) => request.originalUrl ?? request.url ?? '/';

function sendAuthError(
  auth: ResourceServer,
  request: Request,
  response: Response,
  error: AuthError,
): boolean {
  const metadataUrl = `${auth.requestUrl(PROTECTED_RESOURCE_METADATA_PATH, originOf(request))}${pathOf(request).split('?')[0]}`;
  const challenge = auth.challenge(error, metadataUrl);
  if (!challenge) {
    return false;
  }
  response.statusCode = challenge.status;
  response.setHeader('www-authenticate', challenge.header);
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(
    JSON.stringify({
      error: error.code.toLowerCase(),
      error_description: error.message,
    }),
  );
  return true;
}

/**
 * Requires a valid access token. Puts the `AuthContext` on `req.auth` and
 * `res.locals.auth`, or answers 401 with a Bearer challenge.
 */
export function requireAuth(auth: ResourceServer): Middleware {
  return (request, response, next) => {
    auth
      .authenticate(
        {
          authorization: request.headers.authorization,
          cookie: request.headers.cookie,
        },
        auth.requestUrl(pathOf(request), originOf(request)),
      )
      .then((context) => {
        request.auth = context;
        if (response.locals) {
          response.locals.auth = context;
        }
        next();
      })
      .catch((error: unknown) => {
        if (!(error instanceof AuthError) || !sendAuthError(auth, request, response, error)) {
          next(error);
        }
      });
  };
}

/**
 * Requires scopes on the token `requireAuth` accepted. Answers 403 with an
 * `insufficient_scope` challenge naming the scopes.
 *
 * requireScopes('notes:read', 'notes:write')            // all of them
 * requireScopes({ mode: 'any', scopes: ['a', 'b'] })    // at least one
 */
export function requireScopes(
  ...scopes: string[] | [Partial<RequiredScopes>]
): Middleware {
  const required = toRequiredScopes(scopes);
  return (request, response, next) => {
    try {
      assertScopes(request.auth, required);
      next();
    } catch (error) {
      if (!(error instanceof AuthError)) {
        return next(error);
      }
      const challenge = buildChallenge(error);
      if (!challenge) {
        return next(error);
      }
      response.statusCode = challenge.status;
      response.setHeader('www-authenticate', challenge.header);
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          error: error.code.toLowerCase(),
          error_description: error.message,
        }),
      );
    }
  };
}

/**
 * Serves RFC 9728 protected resource metadata for a resource server that is
 * not itself the authorization server. Mount it at the root of the app.
 */
export function protectedResourceMetadata(
  resources: ResourceRegistry | ProtectedResource[],
  options: { authorizationServers: string[] },
): Middleware {
  return (request, response, next) => {
    const path = pathOf(request).split('?')[0];
    if (request.method !== 'GET' || !path.startsWith(PROTECTED_RESOURCE_METADATA_PATH)) {
      return next();
    }
    findResourceByPath(
      resources,
      path.slice(PROTECTED_RESOURCE_METADATA_PATH.length) || '/',
    )
      .then((resource) => {
        if (!resource) {
          return next();
        }
        response.statusCode = 200;
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.setHeader('cache-control', 'public, max-age=300');
        response.end(
          JSON.stringify(
            buildProtectedResourceMetadata(resource, options.authorizationServers),
          ),
        );
      })
      .catch(next);
  };
}

/**
 * Every endpoint of the authorization server as one middleware: discovery,
 * JWKS, authorize, consent, token, registration, introspection, revocation
 * and the browser session. Mount it at the root: `app.use(authRouter(server))`.
 */
export function authRouter(server: OAuthServer, options: AuthHttpOptions = {}): Middleware {
  const handle = createNodeAuthHandler(server, options);
  return (request, response, next) => {
    void handle(request, response, next);
  };
}
