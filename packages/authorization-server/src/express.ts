import { extractBearerToken } from './authorization-server.js';
import { InsufficientScopeError, InvalidTokenError } from './errors.js';
import type {
  AuthContext,
  ExpressMiddleware,
  ExpressRequestLike,
  ExpressResponseLike,
  ValidateTokenOptions,
} from './types.js';

type CoreAuth = {
  validateToken(token: string, options?: ValidateTokenOptions): Promise<AuthContext>;
  discovery: {
    jwks(): Promise<unknown>;
    authorizationServerMetadata(): Promise<unknown>;
    protectedResourceMetadata(resource: string): Promise<unknown>;
  };
};

export function createExpressAdapter(auth: CoreAuth) {
  return {
    authenticate(options: ValidateTokenOptions = {}): ExpressMiddleware {
      return async (req, res, next) => {
        try {
          const token = extractBearerToken(req.headers) ?? req.cookies?.access_token;
          if (!token) {
            throw new InvalidTokenError('Missing bearer token');
          }
          req.auth = await auth.validateToken(token, options);
          next();
        } catch (error) {
          writeAuthError(res, error);
        }
      };
    },
    requireScopes(scopes: string | string[], mode: 'all' | 'any' = 'all'): ExpressMiddleware {
      const requiredScopes = Array.isArray(scopes) ? scopes : [scopes];
      return (req, res, next) => {
        try {
          if (!req.auth) {
            throw new InvalidTokenError('Missing authenticated request context');
          }
          req.auth.requireScopes(requiredScopes, mode);
          next();
        } catch (error) {
          writeAuthError(res, error);
        }
      };
    },
    currentAuth(req: ExpressRequestLike) {
      return req.auth;
    },
    currentPrincipal(req: ExpressRequestLike) {
      return req.auth?.principal;
    },
    routes(): ExpressMiddleware {
      return async (req, res, next) => {
        const path = req.path ?? req.url ?? '';
        if (path.endsWith('/.well-known/jwks.json') || path === '/.well-known/jwks.json') {
          res.json(await auth.discovery.jwks());
          return;
        }
        if (path.includes('/.well-known/oauth-authorization-server')) {
          res.json(await auth.discovery.authorizationServerMetadata());
          return;
        }
        if (path.includes('/.well-known/oauth-protected-resource')) {
          res.json(await auth.discovery.protectedResourceMetadata(path.split('/').pop() ?? ''));
          return;
        }
        next();
      };
    },
  };
}

export function writeAuthError(res: ExpressResponseLike, error: unknown) {
  if (error instanceof InsufficientScopeError) {
    res.status(403).json({ error: 'insufficient_scope', error_description: error.message });
    return;
  }
  if (error instanceof InvalidTokenError) {
    res.status(401).json({ error: 'invalid_token', error_description: error.message });
    return;
  }
  res.status(500).json({ error: 'server_error' });
}

export { createAuthorizationServer } from './authorization-server.js';
export type { ExpressMiddleware, ExpressRequestLike, ExpressResponseLike } from './types.js';
