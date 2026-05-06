import cookie from 'cookie';
import express, { type NextFunction, type Request, type RequestHandler, type Response, type Router } from 'express';

import { createPublicClient } from './index.js';
import { AuthorizationServerError, InvalidClientError, InvalidTokenError } from './errors.js';
import type { McpServerHandle } from './mcp.js';
import type {
  AuthContext,
  AuthorizationCode,
  AuthorizationServer,
  AuthorizationServerOptions,
  StoredAuthorizationInteraction,
} from './types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export type ExpressAuthAdapter = {
  routes(): Router;
  authenticate(options?: { audience?: string; requiredScopes?: string[] }): RequestHandler;
  requireScopes(...scopes: string[]): RequestHandler;
  consentPage(handler: (ctx: StoredAuthorizationInteraction, req: Request, res: Response) => void | Promise<void>): RequestHandler;
  submitConsent(): RequestHandler;
  switchAccount(): RequestHandler;
};

type AdapterState = {
  auth: AuthorizationServer;
  options: AuthorizationServerOptions;
  issuer: string;
  basePath: string;
  mcpServers: Map<string, McpServerHandle>;
};

export async function createExpressAuthorizationServer(options: AuthorizationServerOptions): Promise<AuthorizationServer> {
  const { createAuthorizationServer } = await import('./index.js');
  return createAuthorizationServer(options);
}

export function createExpressAdapter(state: AdapterState): ExpressAuthAdapter {
  const storage = state.options.storage;
  const cookieName = state.options.session?.cookieName ?? 'access_token';

  const adapter: ExpressAuthAdapter = {
    routes() {
      const router = express.Router();
      router.use(express.urlencoded({ extended: false }));
      router.use(express.json());

      router.get('/.well-known/jwks.json', asyncHandler(async (_req, res) => { res.json(await state.auth.discovery.jwks()); }));
      router.get('/.well-known/oauth-authorization-server', asyncHandler(async (_req, res) => { res.json(await state.auth.discovery.authorizationServerMetadata()); }));
      router.get('/.well-known/oauth-protected-resource', asyncHandler(async (req, res) => {
        const resource = typeof req.query.resource === 'string' ? req.query.resource : state.issuer;
        res.json(await state.auth.discovery.protectedResourceMetadata(resource));
      }));
      router.post('/clients/register', asyncHandler(async (req, res) => {
        const client = createPublicClient({
          name: req.body.client_name,
          redirectUris: asArray(req.body.redirect_uris),
          scopes: asArray(req.body.scope ?? req.body.scopes),
        });
        await storage.saveClient(client);
        res.status(201).json({
          client_id: client.id,
          client_name: client.name,
          redirect_uris: client.redirectUris,
          scope: client.scopes.join(' '),
        });
      }));
      router.post('/login', asyncHandler(async (req, res) => {
        const principal = await state.options.identityProvider.authenticatePassword?.({
          email: req.body.email,
          username: req.body.username,
          password: req.body.password,
        });
        if (!principal) throw new AuthorizationServerError('Invalid credentials', 'invalid_grant', 401);
        const token = await state.auth.issueToken({
          subject: principal.id,
          principal,
          audience: state.issuer,
          scopes: asArray(req.body.scope ?? req.body.scopes),
          ttlSeconds: state.options.session?.ttlSeconds,
        });
        setAuthCookie(res, cookieName, token.accessToken, state.options);
        if (req.body.returnTo) return res.redirect(String(req.body.returnTo));
        res.json(token);
      }));
      router.post('/logout', (_req, res) => {
        clearAuthCookie(res, cookieName, state.options);
        res.status(204).send();
      });
      router.get('/session', adapter.authenticate({ audience: state.issuer }), (req, res) => res.json({ principal: req.auth?.principal, subject: req.auth?.subject, scopes: req.auth?.scopes }));
      router.get('/authorize', asyncHandler(async (req, res) => authorize(state, req, res)));
      router.get('/consent/:flowId', asyncHandler(async (req, res) => renderDefaultConsent(state, req, res)));
      router.post('/consent/:flowId', adapter.submitConsent());
      router.post('/consent/:flowId/switch-account', adapter.switchAccount());
      router.post('/token', asyncHandler(async (req, res) => token(state, req, res)));
      router.post('/introspect', asyncHandler(async (req, res) => {
        try {
          const ctx = await state.auth.validateToken(String(req.body.token ?? ''));
          res.json({ active: true, sub: ctx.subject, scope: ctx.scopes.join(' '), principal: ctx.principal });
        } catch {
          res.json({ active: false });
        }
      }));
      return router;
    },
    authenticate(options) {
      return asyncHandler(async (req, res, next) => {
        const raw = extractToken(req, cookieName);
        if (!raw) {
          res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${state.issuer}/.well-known/oauth-protected-resource"`);
          throw new InvalidTokenError('Missing bearer token');
        }
        req.auth = await state.auth.validateToken(raw, options);
        next();
      });
    },
    requireScopes(...scopes) {
      return asyncHandler(async (req, _res, next) => {
        if (!req.auth) throw new InvalidTokenError('Request is not authenticated');
        const missing = scopes.filter((scope) => !req.auth?.scopes.includes(scope));
        if (missing.length > 0) throw new AuthorizationServerError(`Missing required scopes: ${missing.join(', ')}`, 'insufficient_scope', 403);
        next();
      });
    },
    consentPage(handler) {
      return asyncHandler(async (req, res) => {
        const interaction = await storage.getInteraction(String(req.params.flowId));
        if (!interaction) throw new AuthorizationServerError('Unknown authorization flow', 'invalid_request', 404);
        await handler(interaction, req, res);
      });
    },
    submitConsent() {
      return asyncHandler(async (req, res) => submitConsent(state, req, res));
    },
    switchAccount() {
      return asyncHandler(async (req, res) => {
        clearAuthCookie(res, cookieName, state.options);
        res.redirect(`${state.basePath}/login?flow=${encodeURIComponent(String(req.params.flowId))}`);
      });
    },
  };

  return adapter;
}

async function authorize(state: AdapterState, req: Request, res: Response): Promise<void> {
  const clientId = stringParam(req.query.client_id);
  const redirectUri = stringParam(req.query.redirect_uri);
  if (!clientId || !redirectUri) throw new AuthorizationServerError('client_id and redirect_uri are required', 'invalid_request');
  const client = await state.options.storage.getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) throw new InvalidClientError();
  await state.options.storage.touchClient(client.id);
  const requestedScopes = stringParam(req.query.scope)?.split(' ').filter(Boolean) ?? [];
  const flowId = crypto.randomUUID();
  let principal: AuthContext['principal'];
  const existingToken = extractToken(req, state.options.session?.cookieName ?? 'access_token');
  if (existingToken) {
    try {
      principal = (await state.auth.validateToken(existingToken, { audience: state.issuer })).principal;
    } catch {
      principal = undefined;
    }
  }
  const interaction: StoredAuthorizationInteraction = {
    flowId,
    clientId: client.id,
    client: { id: client.id, name: client.name, redirectUris: client.redirectUris },
    redirectUri,
    state: stringParam(req.query.state),
    resource: stringParam(req.query.resource),
    audience: stringParam(req.query.resource) ?? stringParam(req.query.audience),
    scopes: requestedScopes.map((id) => ({ id })),
    principal,
    loginRequired: !principal,
    consentRequired: true,
    codeChallenge: stringParam(req.query.code_challenge),
    codeChallengeMethod: stringParam(req.query.code_challenge_method),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  await state.options.storage.saveInteraction(interaction);
  res.redirect(`${state.basePath}/consent/${flowId}`);
}

async function renderDefaultConsent(state: AdapterState, req: Request, res: Response): Promise<void> {
  const interaction = await state.options.storage.getInteraction(String(req.params.flowId));
  if (!interaction) throw new AuthorizationServerError('Unknown authorization flow', 'invalid_request', 404);
  if (interaction.loginRequired) {
    res.status(401).type('html').send(`<h1>Login required</h1><p>POST credentials to ${state.basePath}/login with returnTo=${state.basePath}/consent/${interaction.flowId}</p>`);
    return;
  }
  res.type('html').send(`<!doctype html><html><body><h1>Authorize ${escapeHtml(interaction.client.name ?? interaction.client.id)}</h1><p>Principal: ${escapeHtml(interaction.principal?.displayName ?? interaction.principal?.email ?? interaction.principal?.id ?? '')}</p><p>Scopes: ${escapeHtml(interaction.scopes.map((scope) => scope.id).join(', '))}</p><form method="post"><button name="decision" value="approve">Approve</button><button name="decision" value="deny">Deny</button></form><form method="post" action="${state.basePath}/consent/${interaction.flowId}/switch-account"><button>Log in as a different user</button></form></body></html>`);
}

async function submitConsent(state: AdapterState, req: Request, res: Response): Promise<void> {
  const interaction = await state.options.storage.getInteraction(String(req.params.flowId));
  if (!interaction) throw new AuthorizationServerError('Unknown authorization flow', 'invalid_request', 404);
  if (req.body.decision === 'deny') {
    await state.options.storage.deleteInteraction(interaction.flowId);
    const url = new URL(interaction.redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (interaction.state) url.searchParams.set('state', interaction.state);
    res.redirect(url.toString());
    return;
  }
  if (!interaction.principal) throw new AuthorizationServerError('Login required', 'login_required', 401);
  const code: AuthorizationCode = {
    code: crypto.randomUUID(),
    clientId: interaction.clientId,
    redirectUri: interaction.redirectUri,
    subject: interaction.principal.id,
    principal: interaction.principal,
    scopes: interaction.scopes.map((scope) => scope.id),
    audience: interaction.audience,
    codeChallenge: interaction.codeChallenge,
    codeChallengeMethod: interaction.codeChallengeMethod,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  await state.options.storage.saveAuthorizationCode(code);
  await state.options.storage.deleteInteraction(interaction.flowId);
  const url = new URL(interaction.redirectUri);
  url.searchParams.set('code', code.code);
  if (interaction.state) url.searchParams.set('state', interaction.state);
  res.redirect(url.toString());
}

async function token(state: AdapterState, req: Request, res: Response): Promise<void> {
  const grantType = String(req.body.grant_type ?? '');
  if (grantType === 'authorization_code') {
    const code = await state.options.storage.consumeAuthorizationCode(String(req.body.code ?? ''));
    if (!code || code.redirectUri !== String(req.body.redirect_uri ?? '')) throw new AuthorizationServerError('Invalid authorization code', 'invalid_grant', 400);
    const token = await state.auth.issueToken({ subject: code.subject, principal: code.principal, audience: code.audience, scopes: code.scopes });
    res.json(toOAuthToken(token));
    return;
  }
  if (grantType === 'password') {
    const principal = await state.options.identityProvider.authenticatePassword?.({ email: req.body.email ?? req.body.username, username: req.body.username, password: req.body.password });
    if (!principal) throw new AuthorizationServerError('Invalid credentials', 'invalid_grant', 401);
    const token = await state.auth.issueToken({ subject: principal.id, principal, audience: stringBody(req.body.audience) ?? stringBody(req.body.resource), scopes: asArray(req.body.scope) });
    res.json(toOAuthToken(token));
    return;
  }
  throw new AuthorizationServerError('Unsupported grant type', 'unsupported_grant_type', 400);
}

function toOAuthToken(token: { accessToken: string; expiresIn: number; scope: string; tokenType: 'Bearer' }) {
  return { access_token: token.accessToken, token_type: token.tokenType, expires_in: token.expiresIn, scope: token.scope };
}

function extractToken(req: Request, cookieName: string): string | null {
  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) return authorization.slice('bearer '.length).trim();
  const cookies = cookie.parse(req.header('cookie') ?? '');
  return cookies[cookieName] ?? null;
}

function setAuthCookie(res: Response, name: string, value: string, options: AuthorizationServerOptions): void {
  res.setHeader('Set-Cookie', cookie.serialize(name, value, {
    httpOnly: true,
    path: '/',
    sameSite: options.session?.sameSite ?? 'lax',
    secure: options.session?.secure ?? false,
    maxAge: options.session?.ttlSeconds ?? 900,
  }));
}

function clearAuthCookie(res: Response, name: string, options: AuthorizationServerOptions): void {
  res.setHeader('Set-Cookie', cookie.serialize(name, '', {
    httpOnly: true,
    path: '/',
    sameSite: options.session?.sameSite ?? 'lax',
    secure: options.session?.secure ?? false,
    maxAge: 0,
  }));
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      const status = error instanceof AuthorizationServerError ? error.statusCode : 500;
      res.status(status).json({ error: error instanceof AuthorizationServerError ? error.code : 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' });
    });
  };
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringBody(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}
