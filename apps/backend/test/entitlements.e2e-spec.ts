import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes } from 'crypto';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AgentsService } from '../src/agents/agents.service';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { WORKSPACE_ADMIN_SCOPE_IDS } from '../src/entitlements/entitlements.scopes';

/** The cookies of a response, as one Cookie header. */
function cookiesFrom(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.map((c: string) => c.split(';')[0].trim()).join('; ');
}

function sessionScopes(cookies: string): string[] {
  const token = cookies
    .split('; ')
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (!token) throw new Error('no access_token cookie');
  return (decodeJwt(token) as { scope: string[] }).scope;
}

const unique = () => Math.random().toString(36).slice(2, 10);

describe('Entitlements (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  /** A plain member of the default workspace. */
  let member: string;
  /** An admin of the default workspace (not an installation operator). */
  let admin: string;
  let agentSlug: string;

  async function signIn(role: WorkspaceRole): Promise<string> {
    const email = `ent-${unique()}@example.com`;
    const password = 'password-entitlements';
    await app.get(IdentityProviderService).createUser({
      email,
      password,
      slug: `ent-${unique()}`,
      displayName: `Entitlements ${role}`,
      workspace: { workspaceId: DEFAULT_WORKSPACE_ID, role },
    });
    const res = await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return cookiesFrom(res);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = app.getHttpServer();

    member = await signIn(WorkspaceRole.MEMBER);
    admin = await signIn(WorkspaceRole.ADMIN);

    agentSlug = `ent-agent-${unique()}`;
    await app.get(AgentsService).createAgent(DEFAULT_WORKSPACE_ID, {
      slug: agentSlug,
      name: 'Entitlements agent',
      systemPrompt: 'Test agent for entitlements coverage.',
      statusTriggers: [],
      allowedTools: [],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('web sessions', () => {
    it('give workspace-settings writes to admins only', () => {
      const memberScopes = sessionScopes(member);
      const adminScopes = sessionScopes(admin);
      for (const scope of WORKSPACE_ADMIN_SCOPE_IDS) {
        expect(memberScopes).not.toContain(scope);
        expect(adminScopes).toContain(scope);
      }
      // Neither is an installation operator.
      expect(memberScopes).not.toContain('installation:admin');
      expect(adminScopes).not.toContain('installation:admin');
      // Both still do everyday work.
      expect(memberScopes).toEqual(expect.arrayContaining(['tasks:write', 'context:write', 'threads:write']));
    });

    it('stop a member from changing the MCP registry or GitHub connections', async () => {
      await request(http)
        .post('/api/v1/mcp/servers')
        .set('Cookie', member)
        .send({
          providedId: `ent-server-${unique()}`,
          name: 'Member server',
          description: 'Members cannot add servers',
          type: 'http',
          url: 'http://localhost:3000/test/mcp',
        })
        .expect(403);
      await request(http)
        .post('/api/v1/integrations/github/connections')
        .set('Cookie', member)
        .send({ name: 'Member connection', authType: 'token', token: 'x' })
        .expect(403);

      await request(http)
        .post('/api/v1/mcp/servers')
        .set('Cookie', admin)
        .send({
          providedId: `ent-server-${unique()}`,
          name: 'Admin server',
          description: 'Admins can add servers',
          type: 'http',
          url: 'http://localhost:3000/test/mcp',
        })
        .expect(201);
    });
  });

  describe('agent tokens', () => {
    it('never carry more than the issuer and the agent are entitled to', async () => {
      for (const scope of ['user:admin', 'installation:admin', 'mcp-registry:write', 'workers:connect']) {
        const refused = await request(http)
          .post(`/api/v1/agents/${agentSlug}/tokens`)
          .set('Cookie', member)
          .send({ name: `escalate ${scope}`, scopes: ['tasks:read', scope] })
          .expect(403);
        expect(refused.body.code).toBe('TOKEN_SCOPE_NOT_ENTITLED');
      }

      // An admin can't hand an agent (always a member) admin scopes either.
      await request(http)
        .post(`/api/v1/agents/${agentSlug}/tokens`)
        .set('Cookie', admin)
        .send({ name: 'admin delegates admin', scopes: ['user:admin'] })
        .expect(403);
    });

    it('are issued for everyday scopes', async () => {
      const issued = await request(http)
        .post(`/api/v1/agents/${agentSlug}/tokens`)
        .set('Cookie', member)
        .send({ name: 'everyday', scopes: ['tasks:read', 'tasks:write'] })
        .expect(201);
      expect(decodeJwt(issued.body.token).scope).toEqual(['tasks:read', 'tasks:write']);
    });
  });
  describe('MCP OAuth tokens', () => {
    const VERSION = '0.0.0';
    const REDIRECT_URI = 'http://127.0.0.1:6276/callback';
    /** A Taico-auth registry server that offers an everyday and an admin-only scope. */
    let serverId: string;

    beforeAll(async () => {
      serverId = `ent-oauth-${unique()}`;
      const created = await request(http)
        .post('/api/v1/mcp/servers')
        .set('Cookie', admin)
        .send({
          providedId: serverId,
          name: 'Entitlements OAuth server',
          description: 'Offers an admin-only scope',
          type: 'http',
          url: 'http://localhost:3000/test/mcp',
        })
        .expect(201);
      await request(http)
        .post(`/api/v1/mcp/servers/${created.body.id}/scopes`)
        .set('Cookie', admin)
        .send(['tasks:read', 'mcp-registry:write'].map((id) => ({ id, description: id })))
        .expect(201);
    });

    /** Runs the OAuth code flow, consented with `cookies`, asking for both scopes. */
    async function authorize(cookies: string) {
      const registered = await request(http)
        .post(`/api/v1/auth/clients/register/mcp/${serverId}/${VERSION}`)
        .send({
          client_name: `ent client ${unique()}`,
          redirect_uris: [REDIRECT_URI],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        })
        .expect(201);
      const clientId: string = registered.body.client_id;
      const codeVerifier = randomBytes(32).toString('base64url');
      const started = await request(http)
        .get(`/api/v1/auth/authorize/mcp/${serverId}/${VERSION}`)
        .query({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          scope: 'tasks:read mcp-registry:write',
          state: 'ent-state',
          code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
          code_challenge_method: 'S256',
        })
        .expect(302);
      const flowId = new URL(started.headers.location, 'http://x').searchParams.get('flow');
      const approved = await request(http)
        .post(`/api/v1/auth/authorize/mcp/${serverId}/${VERSION}`)
        .set('Cookie', cookies)
        .send({ flow_id: flowId, approved: true })
        .expect(302);
      const code = new URL(approved.headers.location).searchParams.get('code');
      const tokens = await request(http)
        .post(`/api/v1/auth/token/mcp/${serverId}/${VERSION}`)
        .send({
          grant_type: 'authorization_code',
          client_id: clientId,
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        })
        .expect(201);
      return { clientId, body: tokens.body };
    }

    function refresh(clientId: string, refreshToken: string) {
      return request(http)
        .post(`/api/v1/auth/token/mcp/${serverId}/${VERSION}`)
        .send({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken })
        .expect(201);
    }

    /** The token's scopes, as signed and as the response reports them; they must agree. */
    function granted(body: { access_token: string; scope?: string }): string[] {
      const signed = decodeJwt(body.access_token).scope as string[];
      expect(body.scope?.split(' ').filter(Boolean)).toEqual(signed);
      return signed;
    }

    it("grant a member only their role's scopes, and say so in the response", async () => {
      const { body } = await authorize(member);
      expect(granted(body)).toEqual(['tasks:read']);
    });

    it('grant an admin every consented scope', async () => {
      const { body } = await authorize(admin);
      expect(granted(body)).toEqual(['tasks:read', 'mcp-registry:write']);
    });

    it('narrow at refresh once an admin is demoted, and widen again on promotion', async () => {
      const demotee = await signIn(WorkspaceRole.ADMIN);
      const demoteeActorId = decodeJwt(
        demotee.split('; ').find((c) => c.startsWith('access_token='))!.slice('access_token='.length),
      ).actor_id as string;
      const { clientId, body } = await authorize(demotee);
      expect(granted(body)).toEqual(['tasks:read', 'mcp-registry:write']);

      const setRole = (role: WorkspaceRole) =>
        request(http)
          .patch(`/api/v1/workspaces/current/members/${demoteeActorId}`)
          .set('Cookie', admin)
          .send({ role })
          .expect(200);

      await setRole(WorkspaceRole.MEMBER);
      const demoted = (await refresh(clientId, body.refresh_token)).body;
      expect(granted(demoted)).toEqual(['tasks:read']);

      // The consent is kept, so promotion restores what was authorized.
      await setRole(WorkspaceRole.ADMIN);
      const promoted = (await refresh(clientId, demoted.refresh_token)).body;
      expect(granted(promoted)).toEqual(['tasks:read', 'mcp-registry:write']);
    });
  });
});
