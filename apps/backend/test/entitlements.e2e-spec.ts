import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
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
});
