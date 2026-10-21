import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildChallenge, type Challenge } from '../core/challenge.js';
import { AuthError } from '../core/errors.js';
import {
  createNodeAuthHandler,
  createNodeProtectedResourceMetadata,
  type AuthHttpOptions,
} from '../core/http.js';
import type { OAuthServer } from '../core/oauth-server.js';
import type { ProtectedResource, ResourceRegistry } from '../core/ports.js';
import {
  assertScopes,
  type ProtectedResourceMetadataOptions,
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

/** Metadata URL `requireAuth` worked out, for the 403s `requireScopes` sends */
const metadataUrls = new WeakMap<object, string>();

function sendAuthError(
  response: Response,
  error: AuthError,
  challenge: Challenge | null,
): boolean {
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
    const requestUrl = auth.requestUrl(pathOf(request), originOf(request));
    const metadataUrl = auth.resourceMetadataUrl(requestUrl);
    if (metadataUrl) {
      metadataUrls.set(request, metadataUrl);
    }
    auth
      .authenticate(
        {
          authorization: request.headers.authorization,
          cookie: request.headers.cookie,
        },
        requestUrl,
      )
      .then((context) => {
        request.auth = context;
        if (response.locals) {
          response.locals.auth = context;
        }
        next();
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof AuthError) ||
          !sendAuthError(response, error, auth.challenge(error, metadataUrl))
        ) {
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
      if (
        !(error instanceof AuthError) ||
        !sendAuthError(
          response,
          error,
          buildChallenge(error, { resourceMetadataUrl: metadataUrls.get(request) }),
        )
      ) {
        next(error);
      }
    }
  };
}

/**
 * Serves RFC 9728 protected resource metadata for a resource server that is
 * not itself the authorization server. Mount it at the root of the app.
 * `authorizationServers` may be a function of the resource, when each
 * resource has its own authorization server.
 */
export function protectedResourceMetadata(
  resources: ResourceRegistry | readonly ProtectedResource[],
  options: ProtectedResourceMetadataOptions,
): Middleware {
  const handle = createNodeProtectedResourceMetadata(resources, options);
  return (request, response, next) => {
    void handle(request, response, next);
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
