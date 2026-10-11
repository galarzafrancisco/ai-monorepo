import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes } from 'crypto';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { INTERNAL_WORKER_AUTH_TARGET_ID } from '../src/auth/core/constants/internal-auth-target.constant';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { getConfig } from '../src/config/env.config';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

const VERSION = '0.0.0';
const REDIRECT_URI = 'http://localhost:6274/oauth/callback';
const TASKS_MCP_PATH = '/api/v1/tasks/tasks/mcp';
const CONTEXT_MCP_PATH = '/api/v1/context/blocks/mcp';

type TokenSet = {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  claims: AccessTokenClaims;
};

describe('MCP OAuth issuer discovery and resource binding (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let issuerUrl: string;
  let tasksResource: string;
  let contextResource: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '/.well-known/*path', method: RequestMethod.ALL }],
    });

    await app.init();
    httpServer = app.getHttpServer();

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);

    issuerUrl = getConfig().issuerUrl;
    tasksResource = `${issuerUrl}${TASKS_MCP_PATH}`;
    contextResource = `${issuerUrl}${CONTEXT_MCP_PATH}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerClient(serverId: string): Promise<string> {
    const response = await request(httpServer)
      .post(`/api/v1/auth/clients/register/mcp/${serverId}/${VERSION}`)
      .send({
        client_name: `Resource binding test client ${randomBytes(4).toString('hex')}`,
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      })
      .expect(201);
    return response.body.client_id;
  }

  function startAuthorization(
    serverId: string,
    clientId: string,
    codeChallenge: string,
    resource?: string,
    scope = 'mcp:use',
  ) {
    return request(httpServer)
      .get(`/api/v1/auth/authorize/mcp/${serverId}/${VERSION}`)
      .query({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        scope,
        state: 'test-state',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...(resource ? { resource } : {}),
      });
  }

  /**
   * Runs registration, authorization and consent, stopping before the token request.
   */
  async function obtainAuthorizationCode(
    serverId: string,
    resource?: string,
    scope?: string,
  ): Promise<{ clientId: string; code: string; codeVerifier: string }> {
    const clientId = await registerClient(serverId);
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const authorizeResponse = await startAuthorization(
      serverId,
      clientId,
      codeChallenge,
      resource,
      scope,
    ).expect(302);
    const flowId = new URL(authorizeResponse.headers.location).searchParams.get(
      'flow',
    );
    expect(flowId).toBeTruthy();

    const consentResponse = await request(httpServer)
      .post(`/api/v1/auth/authorize/mcp/${serverId}/${VERSION}`)
      .set('Cookie', authCookies)
      .send({ flow_id: flowId, approved: true })
      .expect(302);
    const code = new URL(consentResponse.headers.location).searchParams.get(
      'code',
    );
    expect(code).toBeTruthy();

    return { clientId, code: code!, codeVerifier };
  }

  function requestToken(serverId: string, body: Record<string, string>) {
    return request(httpServer)
      .post(`/api/v1/auth/token/mcp/${serverId}/${VERSION}`)
      .send(body);
  }

  async function obtainTokens(
    serverId: string,
    resource?: string,
    scope?: string,
  ): Promise<TokenSet> {
    const { clientId, code, codeVerifier } = await obtainAuthorizationCode(
      serverId,
      resource,
      scope,
    );
    const response = await requestToken(serverId, {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      ...(resource ? { resource } : {}),
    }).expect(201);

    return {
      clientId,
      accessToken: response.body.access_token,
      refreshToken: response.body.refresh_token,
      claims: decodeJwt(
        response.body.access_token,
      ) as unknown as AccessTokenClaims,
    };
  }

  function callMcp(path: string, token: string) {
    return request(httpServer)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'resource-binding-test', version: '0.0.0' },
        },
      });
  }

  async function signWithAudience(
    claims: AccessTokenClaims,
    aud: string | string[] | undefined,
  ): Promise<string> {
    const { aud: _aud, ...rest } = claims;
    return app.get(TokenSignerService).signToken({
      ...rest,
      ...(aud === undefined ? {} : { aud }),
    } as AccessTokenClaims);
  }

  describe('discovery', () => {
    it.each([
      ['tasks', TASKS_MCP_PATH],
      ['context', CONTEXT_MCP_PATH],
    ])(
      'resource metadata for %s leads to authorization server metadata with the same issuer',
      async (_serverId, mcpPath) => {
        // 1) The unauthenticated MCP request points at the resource metadata
        const unauthenticated = await request(httpServer)
          .post(mcpPath)
          .expect(401);
        const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(
          unauthenticated.headers['www-authenticate'],
        )?.[1];
        expect(resourceMetadataUrl).toBe(
          `${issuerUrl}/.well-known/oauth-protected-resource${mcpPath}`,
        );

        // 2) Resource metadata names the resource and its authorization server
        const resourceMetadata = await request(httpServer)
          .get(new URL(resourceMetadataUrl!).pathname)
          .expect(200);
        expect(resourceMetadata.body.resource).toBe(`${issuerUrl}${mcpPath}`);
        expect(resourceMetadata.body.authorization_servers).toHaveLength(1);
        const advertisedIssuer: string =
          resourceMetadata.body.authorization_servers[0];

        // 3) RFC 8414: the well-known URL is built by inserting the suffix
        //    before the issuer's path, and the document must echo the issuer.
        const issuer = new URL(advertisedIssuer);
        const metadata = await request(httpServer)
          .get(`/.well-known/oauth-authorization-server${issuer.pathname}`)
          .expect(200);
        expect(metadata.body.issuer).toBe(advertisedIssuer);
      },
    );

    it('gives two MCP servers different issuers', async () => {
      const [tasks, context] = await Promise.all(
        ['tasks', 'context'].map((id) =>
          request(httpServer)
            .get(`/.well-known/oauth-authorization-server/mcp/${id}/${VERSION}`)
            .expect(200),
        ),
      );
      expect(tasks.body.issuer).toBe(`${issuerUrl}/mcp/tasks/${VERSION}`);
      expect(context.body.issuer).toBe(`${issuerUrl}/mcp/context/${VERSION}`);
    });
  });

  describe('token issuance', () => {
    it('mints the audience as the canonical resource URI of the server', async () => {
      const tokens = await obtainTokens('tasks', tasksResource);

      expect(tokens.claims.aud).toBe(tasksResource);
      expect(tokens.claims.resource).toBe(tasksResource);
      expect(tokens.claims.mcp_server_identifier).toBe('tasks');
    });

    it('binds the token to the server in the URL when no resource is sent', async () => {
      const tokens = await obtainTokens('context');

      expect(tokens.claims.aud).toBe(contextResource);
    });

    it('rejects an authorization request whose resource names another server', async () => {
      const clientId = await registerClient('tasks');
      const response = await startAuthorization(
        'tasks',
        clientId,
        createHash('sha256').update('x'.repeat(43)).digest('base64url'),
        contextResource,
      ).expect(302);

      const redirect = new URL(response.headers.location);
      expect(`${redirect.origin}${redirect.pathname}`).toBe(REDIRECT_URI);
      expect(redirect.searchParams.get('error')).toBe('invalid_target');
      expect(redirect.searchParams.get('code')).toBeNull();
    });

    it('rejects a token request whose resource differs from the authorized one', async () => {
      const { clientId, code, codeVerifier } = await obtainAuthorizationCode(
        'tasks',
        tasksResource,
      );

      const response = await requestToken('tasks', {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
        resource: contextResource,
      }).expect(400);
      expect(response.body.code).toBe('RESOURCE_MISMATCH');
    });

    it('rejects an authorization code presented at another server token endpoint', async () => {
      const { clientId, code, codeVerifier } =
        await obtainAuthorizationCode('tasks');

      const response = await requestToken('context', {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }).expect(400);
      expect(response.body.code).toBe('SERVER_IDENTIFIER_MISMATCH');

      // The failed attempt must not burn the code for the right endpoint.
      await requestToken('tasks', {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }).expect(201);
    });

    it('keeps the resource binding when refreshing', async () => {
      const tokens = await obtainTokens('tasks', tasksResource);

      // A refresh token cannot be redeemed at another server, nor re-targeted
      await requestToken('context', {
        grant_type: 'refresh_token',
        client_id: tokens.clientId,
        refresh_token: tokens.refreshToken,
      }).expect(400);
      await requestToken('tasks', {
        grant_type: 'refresh_token',
        client_id: tokens.clientId,
        refresh_token: tokens.refreshToken,
        resource: contextResource,
      }).expect(400);

      // Neither failed attempt revoked it
      const refreshed = await requestToken('tasks', {
        grant_type: 'refresh_token',
        client_id: tokens.clientId,
        refresh_token: tokens.refreshToken,
        resource: tasksResource,
      }).expect(201);
      const claims = decodeJwt(refreshed.body.access_token);
      expect(claims.aud).toBe(tasksResource);
      expect(claims.mcp_server_identifier).toBe('tasks');
    });
  });

  describe('resource server validation', () => {
    let tasksTokens: TokenSet;
    let contextTokens: TokenSet;

    beforeAll(async () => {
      tasksTokens = await obtainTokens('tasks', tasksResource);
      contextTokens = await obtainTokens('context', contextResource);
      // Both tokens carry the scope the other MCP endpoint requires.
      expect(tasksTokens.claims.scope).toEqual(['mcp:use']);
      expect(contextTokens.claims.scope).toEqual(['mcp:use']);
    });

    it('accepts a token on the MCP server it was issued for', async () => {
      await callMcp(TASKS_MCP_PATH, tasksTokens.accessToken).expect(200);
      await callMcp(CONTEXT_MCP_PATH, contextTokens.accessToken).expect(200);
    });

    it('rejects a token issued for another MCP server even when scopes overlap', async () => {
      const response = await callMcp(
        CONTEXT_MCP_PATH,
        tasksTokens.accessToken,
      ).expect(401);
      expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
      expect(response.headers['www-authenticate']).toContain(
        'error="invalid_token"',
      );
      expect(response.headers['www-authenticate']).toContain(
        `resource_metadata="${issuerUrl}/.well-known/oauth-protected-resource${CONTEXT_MCP_PATH}"`,
      );

      await callMcp(TASKS_MCP_PATH, contextTokens.accessToken).expect(401);
    });

    it.each([
      ['no audience', undefined],
      ['an empty audience', ''],
      ['the server providedId as audience', 'tasks'],
      ['an unrelated audience', 'https://attacker.example/mcp'],
      ['a list of foreign audiences', ['https://attacker.example/mcp']],
    ])('rejects a token with %s', async (_label, aud) => {
      const token = await signWithAudience(tasksTokens.claims, aud);
      await callMcp(TASKS_MCP_PATH, token).expect(401);
    });

    it('accepts first-party tokens that are not bound to one MCP server', async () => {
      // Internal worker target tokens cover the whole REST API
      const workerToken = await signWithAudience(
        tasksTokens.claims,
        `${issuerUrl}/api/v1`,
      );
      await callMcp(TASKS_MCP_PATH, workerToken).expect(200);
      await callMcp(CONTEXT_MCP_PATH, workerToken).expect(200);

      // System-issued (execution) tokens use the issuer as audience
      const issuedToken = await signWithAudience(tasksTokens.claims, issuerUrl);
      await callMcp(TASKS_MCP_PATH, issuedToken).expect(200);
    });

    it('reports a token as inactive when introspected at another server', async () => {
      const introspect = (serverId: string) =>
        request(httpServer)
          .post(`/api/v1/auth/introspect/mcp/${serverId}/${VERSION}`)
          .send({ token: tasksTokens.accessToken });

      const own = await introspect('tasks').expect(201);
      expect(own.body.active).toBe(true);
      expect(own.body.aud).toBe(tasksResource);

      const other = await introspect('context').expect(201);
      expect(other.body).toEqual({ active: false });

      // A first-party token is not bound to any MCP server
      const { mcp_server_identifier: _id, ...unbound } = tasksTokens.claims;
      const issuedToken = await signWithAudience(
        unbound as AccessTokenClaims,
        issuerUrl,
      );
      const firstParty = await request(httpServer)
        .post(`/api/v1/auth/introspect/mcp/tasks/${VERSION}`)
        .send({ token: issuedToken })
        .expect(201);
      expect(firstParty.body).toEqual({ active: false });
    });

    it('only exchanges a token at the server it was issued for', async () => {
      const exchange = (serverId: string) =>
        request(httpServer)
          .post(`/api/v1/auth/token-exchange/mcp/${serverId}/${VERSION}`)
          .send({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token: tasksTokens.accessToken,
            subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            resource: 'no-such-connection',
          });

      await exchange('context').expect(401);
      // Accepted as a tasks token; tasks simply has no downstream connection
      await exchange('tasks').expect(404);
    });
  });

  describe('REST API and browser session', () => {
    let tasksTokens: TokenSet;
    const listTasks = (token: string) =>
      request(httpServer)
        .get('/api/v1/tasks/tasks')
        .set('Authorization', `Bearer ${token}`);

    beforeAll(async () => {
      // An MCP token that carries the scope the REST endpoint requires
      tasksTokens = await obtainTokens(
        'tasks',
        tasksResource,
        'mcp:use tasks:read',
      );
      expect(tasksTokens.claims.scope).toContain('tasks:read');
    });

    it('rejects an MCP server token on the REST API even with the right scope', async () => {
      const response = await listTasks(tasksTokens.accessToken).expect(401);
      expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it.each([
      ['no audience', undefined],
      [
        'an externally hosted MCP server as audience',
        'https://mcp.example.com/mcp',
      ],
      ['a URL under the API that is not the one requested', '/api/v1/tasks'],
    ])('rejects a token with %s on the REST API', async (_label, aud) => {
      const token = await signWithAudience(
        tasksTokens.claims,
        aud?.startsWith('/') ? `${issuerUrl}${aud}` : aud,
      );
      await listTasks(token).expect(401);
    });

    it.each([
      ['the API root', '/api/v1'],
      ['the issuer', ''],
    ])(
      'accepts a first-party token for %s on the REST API',
      async (_label, path) => {
        const token = await signWithAudience(
          tasksTokens.claims,
          `${issuerUrl}${path}`,
        );
        await listTasks(token).expect(200);
      },
    );

    it.each([
      ['dot segments', `${TASKS_MCP_PATH}/../../tasks`],
      ['encoded dot segments', `${TASKS_MCP_PATH}/%2e%2e/%2e%2e/tasks`],
      ['a longer path', `${TASKS_MCP_PATH}/extra`],
    ])(
      'does not match an MCP token to another path through %s',
      async (_label, path) => {
        const response = await request(httpServer)
          .get(path)
          .set('Authorization', `Bearer ${tasksTokens.accessToken}`);
        expect([401, 404]).toContain(response.status);
      },
    );

    it('accepts worker tokens minted before audiences became URLs', async () => {
      const token = await signWithAudience(
        tasksTokens.claims,
        INTERNAL_WORKER_AUTH_TARGET_ID,
      );
      await listTasks(token).expect(200);
    });

    it('accepts the browser session on the REST API', async () => {
      await request(httpServer)
        .get('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .expect(200);
    });

    it('does not accept an MCP or worker token as a session cookie', async () => {
      const me = (cookie: string) =>
        request(httpServer).get('/api/v1/auth/me').set('Cookie', cookie);

      await me(authCookies).expect(200);
      await me(`access_token=${tasksTokens.accessToken}`).expect(401);
      const workerToken = await signWithAudience(
        tasksTokens.claims,
        `${issuerUrl}/api/v1`,
      );
      await me(`access_token=${workerToken}`).expect(401);
    });
  });

  describe('internal worker target', () => {
    it('issues a token for the whole API that the REST and MCP endpoints accept', async () => {
      // Same request shape as the worker: no resource, worker scopes
      const { clientId, code, codeVerifier } = await obtainAuthorizationCode(
        INTERNAL_WORKER_AUTH_TARGET_ID,
        undefined,
        'tasks:read workers:connect',
      );
      const response = await requestToken(INTERNAL_WORKER_AUTH_TARGET_ID, {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }).expect(201);

      const claims = decodeJwt(response.body.access_token);
      expect(claims.aud).toBe(`${issuerUrl}/api/v1`);

      const introspection = await request(httpServer)
        .post(
          `/api/v1/auth/introspect/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`,
        )
        .send({ token: response.body.access_token, client_id: clientId })
        .expect(201);
      expect(introspection.body.active).toBe(true);

      await request(httpServer)
        .get('/api/v1/tasks/tasks')
        .set('Authorization', `Bearer ${response.body.access_token}`)
        .expect(200);

      // The MCP endpoint accepts the audience too: it gets as far as the scope
      // check, which the worker target does not grant.
      const mcp = await callMcp(TASKS_MCP_PATH, response.body.access_token);
      expect(mcp.status).toBe(403);
      expect(mcp.body.code).toBe('INSUFFICIENT_SCOPE');
    });
  });
});
