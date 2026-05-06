import { extractBearerToken, parseScope } from './authorization-server.js';
import { InsufficientScopeError, InvalidTokenError } from './errors.js';
import type {
  AuthContext,
  AuthorizationInteraction,
  ClientDefinition,
  ExpressMiddleware,
  ExpressRequestLike,
  ExpressResponseLike,
  Principal,
  ValidateTokenOptions,
} from './types.js';

type CoreAuth = {
  basePath: string;
  sessionCookieName: string;
  validateToken(token: string, options?: ValidateTokenOptions): Promise<AuthContext>;
  issueToken(input: { subject: string; principal?: Principal; audience?: string; scopes?: string[] }): Promise<unknown>;
  registerClient(input: ClientDefinition): ClientDefinition;
  getClient(clientId: string): ClientDefinition | undefined;
  authenticatePassword(input: { username?: string; email?: string; password: string }): Promise<{ accessToken: string } | null>;
  createAuthorizationInteraction(input: {
    clientId: string;
    redirectUri?: string;
    scope?: string;
    state?: string;
    resource?: string;
    audience?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'plain' | 'S256';
    principal?: Principal;
  }): Promise<AuthorizationInteraction>;
  approveAuthorizationInteraction(flowId: string, principal: Principal): { code: string; redirectUri?: string; state?: string };
  denyAuthorizationInteraction(flowId: string): AuthorizationInteraction | undefined;
  exchangeAuthorizationCode(input: { code: string; clientId?: string; redirectUri?: string; codeVerifier?: string }): Promise<unknown>;
  exchangeDownstreamToken(input: { subjectToken: string; audience?: string; connection: string; scopes?: string[] }): Promise<unknown>;
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
        try {
          const path = routePath(req);
          const authPath = stripBasePath(path, auth.basePath);
          if (path === '/.well-known/jwks.json') {
            res.json(await auth.discovery.jwks());
            return;
          }
          if (path.startsWith('/.well-known/oauth-authorization-server')) {
            res.json(await auth.discovery.authorizationServerMetadata());
            return;
          }
          if (path.startsWith('/.well-known/oauth-protected-resource')) {
            res.json(await auth.discovery.protectedResourceMetadata(path.split('/').filter(Boolean).at(-1) ?? ''));
            return;
          }
          if (req.method === 'POST' && authPath === '/clients/register') {
            const body = objectBody(req);
            const client = auth.registerClient({
              id: stringField(body.client_id) ?? crypto.randomUUID(),
              name: stringField(body.client_name),
              redirectUris: stringArrayField(body.redirect_uris),
              scopes: parseScope(stringField(body.scope)),
            });
            res.status(201).json({ client_id: client.id, client_name: client.name, redirect_uris: client.redirectUris, scope: client.scopes?.join(' ') ?? '' });
            return;
          }
          if (req.method === 'GET' && authPath === '/authorize') {
            const query = req.query ?? queryFromUrl(req.url);
            const token = extractBearerToken(req.headers) ?? req.cookies?.[auth.sessionCookieName];
            const existingAuth = token ? await auth.validateToken(token).catch(() => undefined) : undefined;
            const flow = await auth.createAuthorizationInteraction({
              clientId: requiredString(query.client_id, 'client_id'),
              redirectUri: stringField(query.redirect_uri),
              scope: stringField(query.scope),
              state: stringField(query.state),
              resource: stringField(query.resource),
              audience: stringField(query.audience),
              codeChallenge: stringField(query.code_challenge),
              codeChallengeMethod: codeChallengeMethod(query.code_challenge_method),
              principal: existingAuth?.principal,
            });
            res.json({ interaction: flow, login_url: `${auth.basePath}/login?flow=${flow.flowId}`, consent_url: `${auth.basePath}/consent/${flow.flowId}` });
            return;
          }
          if (req.method === 'GET' && authPath === '/session') {
            const token = extractBearerToken(req.headers) ?? req.cookies?.[auth.sessionCookieName];
            const session = token ? await auth.validateToken(token).catch(() => undefined) : undefined;
            res.json({ authenticated: Boolean(session), principal: session?.principal, subject: session?.subject, scopes: session?.scopes ?? [] });
            return;
          }
          if (req.method === 'POST' && authPath === '/login') {
            const body = objectBody(req);
            const issued = await auth.authenticatePassword({
              email: stringField(body.email),
              username: stringField(body.username),
              password: requiredString(body.password, 'password'),
            });
            if (!issued) {
              res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid username or password' });
              return;
            }
            res.cookie?.(auth.sessionCookieName, issued.accessToken, { httpOnly: true, sameSite: 'lax' });
            res.json(issued);
            return;
          }
          if (req.method === 'POST' && authPath === '/logout') {
            res.clearCookie?.(auth.sessionCookieName);
            res.status(204).send?.('');
            return;
          }
          const consentMatch = authPath.match(/^\/consent\/([^/]+)(?:\/(approve|deny|switch-account))?$/);
          if (consentMatch && req.method === 'POST') {
            const [, flowId, action = 'approve'] = consentMatch;
            if (action === 'switch-account') {
              res.clearCookie?.(auth.sessionCookieName);
              res.json({ login_url: `${auth.basePath}/login?flow=${flowId}`, flow_id: flowId });
              return;
            }
            if (action === 'deny') {
              const flow = auth.denyAuthorizationInteraction(flowId);
              res.json({ error: 'access_denied', redirect_uri: flow?.redirectUri, state: flow?.state });
              return;
            }
            const token = extractBearerToken(req.headers) ?? req.cookies?.[auth.sessionCookieName];
            if (!token) throw new InvalidTokenError('Consent approval requires an authenticated session');
            const session = await auth.validateToken(token);
            if (!session.principal) throw new InvalidTokenError('Consent approval requires a principal');
            const grant = auth.approveAuthorizationInteraction(flowId, session.principal);
            res.json({ code: grant.code, redirect_uri: grant.redirectUri, state: grant.state });
            return;
          }
          if (req.method === 'POST' && authPath === '/token') {
            const body = objectBody(req);
            const grantType = requiredString(body.grant_type, 'grant_type');
            if (grantType === 'authorization_code') {
              res.json(await auth.exchangeAuthorizationCode({
                code: requiredString(body.code, 'code'),
                clientId: stringField(body.client_id),
                redirectUri: stringField(body.redirect_uri),
                codeVerifier: stringField(body.code_verifier),
              }));
              return;
            }
            if (grantType === 'client_credentials') {
              const clientId = requiredString(body.client_id, 'client_id');
              const client = auth.getClient(clientId);
              if (!client) throw new InvalidTokenError(`Unknown OAuth client: ${clientId}`);
              res.json(await auth.issueToken({ subject: client.id, audience: stringField(body.audience) ?? stringField(body.resource), scopes: parseScope(stringField(body.scope)) }));
              return;
            }
            if (grantType === 'urn:ietf:params:oauth:grant-type:token-exchange') {
              res.json(await auth.exchangeDownstreamToken({
                subjectToken: requiredString(body.subject_token, 'subject_token'),
                audience: stringField(body.audience),
                connection: requiredString(body.requested_token_type, 'requested_token_type'),
                scopes: parseScope(stringField(body.scope)),
              }));
              return;
            }
            res.status(400).json({ error: 'unsupported_grant_type' });
            return;
          }
          if (req.method === 'POST' && authPath === '/introspect') {
            const body = objectBody(req);
            const token = requiredString(body.token, 'token');
            const context = await auth.validateToken(token).catch(() => undefined);
            res.json({ active: Boolean(context), sub: context?.subject, scope: context?.scopes.join(' '), principal: context?.principal });
            return;
          }
          if (req.method === 'POST' && authPath === '/token-exchange') {
            const body = objectBody(req);
            res.json(await auth.exchangeDownstreamToken({
              subjectToken: requiredString(body.subject_token, 'subject_token'),
              audience: stringField(body.audience),
              connection: requiredString(body.connection, 'connection'),
              scopes: parseScope(stringField(body.scope)),
            }));
            return;
          }
          next();
        } catch (error) {
          writeAuthError(res, error);
        }
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

function routePath(req: ExpressRequestLike) {
  return (req.path ?? req.url ?? '').split('?')[0] || '/';
}

function stripBasePath(path: string, basePath: string) {
  if (path === basePath) return '/';
  if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length) || '/';
  return path;
}

function queryFromUrl(url: string | undefined) {
  const query = new URL(url ?? '/', 'http://localhost').searchParams;
  return Object.fromEntries(query.entries());
}

function objectBody(req: ExpressRequestLike): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
}

function stringField(value: unknown) {
  return Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : undefined;
}

function requiredString(value: unknown, name: string) {
  const field = stringField(value);
  if (!field) throw new InvalidTokenError(`Missing required field: ${name}`);
  return field;
}

function stringArrayField(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}

function codeChallengeMethod(value: unknown) {
  const method = stringField(value);
  return method === 'S256' ? 'S256' : method === 'plain' ? 'plain' : undefined;
}

export { createAuthorizationServer } from './authorization-server.js';
export type { ExpressMiddleware, ExpressRequestLike, ExpressResponseLike } from './types.js';
