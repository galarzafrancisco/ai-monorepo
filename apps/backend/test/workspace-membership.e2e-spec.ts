import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { INTERNAL_WORKER_AUTH_TARGET_ID } from '../src/auth/core/constants/internal-auth-target.constant';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { UserRole } from '../src/identity-provider/enums';
import { TagEntity } from '../src/meta/tag.entity';
import { AiProviderEntity } from '../src/ai-providers/ai-provider.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import {
  ensureTestUser,
  getAuthCookies,
  setTestUserRole,
} from './helpers/auth.helper';

/** The cookies of a response, as one Cookie header. */
function cookiesFrom(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.map((c: string) => c.split(';')[0].trim()).join('; ');
}

function accessToken(cookies: string): string {
  const token = cookies
    .split('; ')
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (!token) throw new Error('no access_token cookie');
  return token;
}

function claims(cookies: string) {
  return decodeJwt(accessToken(cookies)) as {
    workspace_id?: string;
    scope: string[];
  };
}

const unique = () => Math.random().toString(36).slice(2, 10);

describe('Workspaces phase 4: many workspaces (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let operatorActorId: string;
  /** The test user, an installation operator, signed in to the default workspace. */
  let operator: string;
  let members: Repository<WorkspaceMemberEntity>;

  function login(email: string, password: string) {
    return request(http).post('/api/v1/auth/login').send({ email, password });
  }

  function switchTo(cookies: string, workspaceId: string) {
    return request(http)
      .post('/api/v1/auth/web/switch-workspace')
      .set('Cookie', cookies)
      .send({ workspaceId });
  }

  async function createWorkspace(cookies: string, name = `Acme ${unique()}`) {
    const slug = `ws-${unique()}`;
    const res = await request(http)
      .post('/api/v1/workspaces')
      .set('Cookie', cookies)
      .send({ name, slug })
      .expect(201);
    return res.body as { id: string; slug: string; name: string };
  }

  /** A person with an account (password set), in the default workspace. */
  async function createPerson() {
    const email = `p4-${unique()}@example.com`;
    const password = 'password-p4';
    const user = await app.get(IdentityProviderService).createUser({
      email,
      password,
      slug: `p4-${unique()}`,
      displayName: 'Phase 4 person',
    });
    return { email, password, actorId: user.actorId };
  }

  /** Sets up an invited account and returns its session cookies. */
  async function setUpInvitedAccount(email: string) {
    const password = 'password-p4-invited';
    const res = await request(http)
      .post('/api/v1/auth/setup-account')
      .send({ email, password, displayName: 'Invited', slug: `inv-${unique()}` })
      .expect(200);
    return { cookies: cookiesFrom(res), password };
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
    members = app.get(getRepositoryToken(WorkspaceMemberEntity));

    operatorActorId = await ensureTestUser(app);
    await setTestUserRole(app, UserRole.ADMIN);
    operator = await getAuthCookies(http);
  });

  afterAll(async () => {
    await setTestUserRole(app, UserRole.STANDARD);
    await app.close();
  });

  describe('creating a workspace', () => {
    it('gives the installation operator installation:admin, and nobody else', async () => {
      expect(claims(operator).scope).toContain('installation:admin');

      const person = await createPerson();
      const res = await login(person.email, person.password).expect(200);
      expect(claims(cookiesFrom(res)).scope).not.toContain('installation:admin');

      await request(http)
        .post('/api/v1/workspaces')
        .set('Cookie', cookiesFrom(res))
        .send({ name: 'Nope', slug: `nope-${unique()}` })
        .expect(403);
    });

    it('makes the operator its admin and seeds tags, the taico agent and providers', async () => {
      const workspace = await createWorkspace(operator);

      const membership = await members.findOneBy({
        workspaceId: workspace.id,
        actorId: operatorActorId,
      });
      expect(membership?.role).toBe(WorkspaceRole.ADMIN);

      const tags = await app
        .get<Repository<TagEntity>>(getRepositoryToken(TagEntity))
        .findBy({ workspaceId: workspace.id });
      expect(tags.length).toBeGreaterThan(0);

      const providers = await app
        .get<Repository<AiProviderEntity>>(getRepositoryToken(AiProviderEntity))
        .findBy({ workspaceId: workspace.id });
      expect(providers.map((p) => p.type).sort()).toEqual(
        ['google_vertex', 'openai'].sort(),
      );

      const switched = await switchTo(operator, workspace.id).expect(200);
      const agent = await request(http)
        .get('/api/v1/agents/taico')
        .set('Cookie', cookiesFrom(switched))
        .expect(200);
      expect(
        await members.findOneBy({ workspaceId: workspace.id, actorId: agent.body.actorId }),
      ).not.toBeNull();
      expect(await members.countBy({ actorId: agent.body.actorId })).toBe(1);
    });

    it('refuses a slug that is taken', async () => {
      const workspace = await createWorkspace(operator);
      await request(http)
        .post('/api/v1/workspaces')
        .set('Cookie', operator)
        .send({ name: 'Again', slug: workspace.slug })
        .expect(409);
    });

    it('lists the workspaces you are in, marking the current one', async () => {
      const workspace = await createWorkspace(operator);
      const res = await request(http)
        .get('/api/v1/workspaces')
        .set('Cookie', operator)
        .expect(200);
      const byId = new Map(res.body.map((w: { id: string }) => [w.id, w]));
      expect(byId.get(DEFAULT_WORKSPACE_ID)).toMatchObject({ current: true });
      expect(byId.get(workspace.id)).toMatchObject({
        current: false,
        role: WorkspaceRole.ADMIN,
        slug: workspace.slug,
      });
    });
  });

  describe('switching workspace', () => {
    it('mints a session for the workspace, which refresh keeps', async () => {
      const workspace = await createWorkspace(operator);
      const res = await switchTo(operator, workspace.id).expect(200);
      const switched = cookiesFrom(res);
      expect(claims(switched).workspace_id).toBe(workspace.id);
      expect(claims(switched).scope).toContain('user:admin');

      const current = await request(http)
        .get('/api/v1/workspaces/current')
        .set('Cookie', switched)
        .expect(200);
      expect(current.body).toMatchObject({ id: workspace.id, current: true });

      // Work done there stays there.
      const task = await request(http)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', switched)
        .send({ name: `p4 task ${unique()}`, description: 'In the new workspace' })
        .expect(201);
      await request(http)
        .get(`/api/v1/tasks/tasks/${task.body.id}`)
        .set('Cookie', operator)
        .expect(404);

      const refreshed = await request(http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', switched)
        .expect(200);
      expect(claims(cookiesFrom(refreshed)).workspace_id).toBe(workspace.id);
    });

    it('revokes the refresh token of the session it replaces', async () => {
      const workspace = await createWorkspace(operator);
      const fresh = await getAuthCookies(http);
      await switchTo(fresh, workspace.id).expect(200);
      await request(http).post('/api/v1/auth/refresh').set('Cookie', fresh).expect(401);
    });

    it('refuses a page still showing the old workspace once another tab switched', async () => {
      const workspace = await createWorkspace(operator);
      const session = await getAuthCookies(http);
      // Tab 2 loaded in the default workspace; tab 1 switches the shared cookies.
      const switched = cookiesFrom(await switchTo(session, workspace.id).expect(200));

      const name = `stale tab task ${unique()}`;
      const stale = await request(http)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', switched)
        .set('x-taico-workspace', DEFAULT_WORKSPACE_ID)
        .send({ name, description: 'Typed while the page showed the default workspace' })
        .expect(409);
      expect(stale.body.code).toBe('WORKSPACE_CHANGED');
      await request(http)
        .get('/api/v1/workspaces/current')
        .set('Cookie', switched)
        .set('x-taico-workspace', DEFAULT_WORKSPACE_ID)
        .expect(409);

      // Nothing was written in the new workspace.
      const tasks = await request(http)
        .get('/api/v1/tasks/tasks')
        .set('Cookie', switched)
        .expect(200);
      const items = (tasks.body.items ?? tasks.body) as { name: string }[];
      expect(items.some((t) => t.name === name)).toBe(false);

      // A page showing the session's workspace, or sending no header, works.
      await request(http)
        .get('/api/v1/workspaces/current')
        .set('Cookie', switched)
        .set('x-taico-workspace', workspace.id)
        .expect(200);
      await request(http).get('/api/v1/workspaces/current').set('Cookie', switched).expect(200);
    });

    it('answers 404 for a workspace you are not in, or that does not exist', async () => {
      const workspace = await createWorkspace(operator);
      const person = await createPerson();
      const res = await login(person.email, person.password).expect(200);
      const cookies = cookiesFrom(res);

      const notMember = await switchTo(cookies, workspace.id).expect(404);
      expect(notMember.body.code).toBe('NOT_IN_WORKSPACE');
      await switchTo(cookies, randomUUID()).expect(404);
      await switchTo('', workspace.id).expect(401);
    });
  });

  describe('members', () => {
    it('invites a new person, who sets up an account in that workspace only', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const email = `p4-new-${unique()}@example.com`;

      const invite = await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email, role: WorkspaceRole.MEMBER })
        .expect(201);
      expect(invite.body.accountCreated).toBe(true);
      expect(invite.body.member.role).toBe(WorkspaceRole.MEMBER);

      const { cookies } = await setUpInvitedAccount(email);
      expect(claims(cookies).workspace_id).toBe(workspace.id);
      expect(claims(cookies).scope).not.toContain('user:admin');
      expect(await members.countBy({ actorId: invite.body.member.actorId })).toBe(1);

      // Not a member of the default workspace.
      await switchTo(cookies, DEFAULT_WORKSPACE_ID).expect(404);
      // Members can list members but not invite.
      const list = await request(http)
        .get('/api/v1/workspaces/current/members')
        .set('Cookie', cookies)
        .expect(200);
      expect(list.body.map((m: { actorId: string }) => m.actorId)).toEqual(
        expect.arrayContaining([operatorActorId, invite.body.member.actorId]),
      );
      await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', cookies)
        .send({ email: `p4-x-${unique()}@example.com`, role: WorkspaceRole.MEMBER })
        .expect(403);
    });

    it('adds a person who already has an account, once', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const person = await createPerson();

      const invite = await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email: person.email, role: WorkspaceRole.ADMIN })
        .expect(201);
      expect(invite.body).toMatchObject({
        accountCreated: false,
        member: { actorId: person.actorId, role: WorkspaceRole.ADMIN },
      });
      await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email: person.email, role: WorkspaceRole.MEMBER })
        .expect(409);

      const own = cookiesFrom(await login(person.email, person.password).expect(200));
      const there = await switchTo(own, workspace.id).expect(200);
      expect(claims(cookiesFrom(there)).scope).toContain('user:admin');
    });

    it('changes roles, in the next token, but never demotes the last admin', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const person = await createPerson();
      await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email: person.email, role: WorkspaceRole.MEMBER })
        .expect(201);
      const own = cookiesFrom(await login(person.email, person.password).expect(200));

      await request(http)
        .patch(`/api/v1/workspaces/current/members/${operatorActorId}`)
        .set('Cookie', admin)
        .send({ role: WorkspaceRole.MEMBER })
        .expect(409);

      await request(http)
        .patch(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .send({ role: WorkspaceRole.ADMIN })
        .expect(200);
      const promoted = await switchTo(own, workspace.id).expect(200);
      expect(claims(cookiesFrom(promoted)).scope).toContain('user:admin');

      // With a second admin, the operator can step down.
      await request(http)
        .patch(`/api/v1/workspaces/current/members/${operatorActorId}`)
        .set('Cookie', admin)
        .send({ role: WorkspaceRole.MEMBER })
        .expect(200);
      const demoted = await switchTo(operator, workspace.id).expect(200);
      expect(claims(cookiesFrom(demoted)).scope).not.toContain('user:admin');
    });

    it('removes a member, who loses the workspace at their next token', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const person = await createPerson();
      await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email: person.email, role: WorkspaceRole.MEMBER })
        .expect(201);
      const own = cookiesFrom(await login(person.email, person.password).expect(200));
      const inWorkspace = cookiesFrom(await switchTo(own, workspace.id).expect(200));

      await request(http)
        .delete(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .expect(204);
      await request(http)
        .delete(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .expect(404);

      // Their next token is for the workspace they are still in.
      const refreshed = await request(http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', inWorkspace)
        .expect(200);
      expect(claims(cookiesFrom(refreshed)).workspace_id).toBe(DEFAULT_WORKSPACE_ID);
      await switchTo(cookiesFrom(refreshed), workspace.id).expect(404);
    });

    it('signs nobody in to a workspace they are not in, even the default one', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const email = `p4-only-${unique()}@example.com`;
      const invite = await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email, role: WorkspaceRole.MEMBER })
        .expect(201);
      const { cookies, password } = await setUpInvitedAccount(email);

      await request(http)
        .delete(`/api/v1/workspaces/current/members/${invite.body.member.actorId}`)
        .set('Cookie', admin)
        .expect(204);

      const refused = await request(http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(403);
      expect(refused.body.code).toBe('NO_WORKSPACE_MEMBERSHIP');
      const noLogin = await login(email, password).expect(403);
      expect(noLogin.body.code).toBe('NO_WORKSPACE_MEMBERSHIP');
    });

    it('never removes the last admin, nor an agent', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));

      await request(http)
        .delete(`/api/v1/workspaces/current/members/${operatorActorId}`)
        .set('Cookie', admin)
        .expect(409);

      const agent = await request(http)
        .get('/api/v1/agents/taico')
        .set('Cookie', admin)
        .expect(200);
      await request(http)
        .delete(`/api/v1/workspaces/current/members/${agent.body.actorId}`)
        .set('Cookie', admin)
        .expect(400);
    });

    it('only manages members of its own workspace', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      // A person in the default workspace only.
      const person = await createPerson();

      await request(http)
        .patch(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .send({ role: WorkspaceRole.ADMIN })
        .expect(404);
      await request(http)
        .delete(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .expect(404);
      expect(
        (await members.findOneBy({ workspaceId: DEFAULT_WORKSPACE_ID, actorId: person.actorId }))
          ?.role,
      ).toBe(WorkspaceRole.MEMBER);
      expect(
        await members.findOneBy({ workspaceId: workspace.id, actorId: person.actorId }),
      ).toBeNull();
    });
  });

  describe('connecting a worker', () => {
    const VERSION = '0.0.0';
    const REDIRECT_URI = 'http://127.0.0.1:6275/callback';
    const tokenPath = `/api/v1/auth/token/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`;

    /** Registers a worker client and starts its OAuth flow; returns the consent flow. */
    async function startWorkerFlow() {
      const registered = await request(http)
        .post(`/api/v1/auth/clients/register/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`)
        .send({
          client_name: `p4 worker ${unique()}`,
          redirect_uris: [REDIRECT_URI],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        })
        .expect(201);
      const clientId: string = registered.body.client_id;
      const codeVerifier = randomBytes(32).toString('base64url');
      const authorize = await request(http)
        .get(`/api/v1/auth/authorize/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`)
        .query({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          scope: 'workers:connect',
          state: 'p4-state',
          code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
          code_challenge_method: 'S256',
        })
        .expect(302);
      const flowId = new URL(authorize.headers.location, 'http://x').searchParams.get('flow');
      return { clientId, codeVerifier, flowId: flowId! };
    }

    /** A worker's OAuth flow, consented with `cookies`. */
    async function authorizeWorker(cookies: string) {
      const { clientId, codeVerifier, flowId } = await startWorkerFlow();
      const consent = await request(http)
        .get(`/api/v1/auth/consent/${flowId}`)
        .set('Cookie', cookies)
        .expect(200);

      const approved = await request(http)
        .post(`/api/v1/auth/authorize/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`)
        .set('Cookie', cookies)
        .send({ flow_id: flowId, approved: true, workspace_id: consent.body.workspace.id })
        .expect(302);
      const code = new URL(approved.headers.location).searchParams.get('code');
      const tokens = await request(http)
        .post(tokenPath)
        .send({
          grant_type: 'authorization_code',
          client_id: clientId,
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        })
        .expect(201);
      return {
        clientId,
        consentWorkspace: consent.body.workspace as { id: string; slug: string },
        refreshToken: tokens.body.refresh_token as string,
        workspaceId: (decodeJwt(tokens.body.access_token) as { workspace_id?: string })
          .workspace_id,
      };
    }

    function refreshWorker(clientId: string, refreshToken: string) {
      return request(http)
        .post(tokenPath)
        .send({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken });
    }

    it('connects to the workspace the person consented in, and refresh keeps it', async () => {
      const workspace = await createWorkspace(operator);
      const inWorkspace = cookiesFrom(await switchTo(operator, workspace.id).expect(200));

      const worker = await authorizeWorker(inWorkspace);
      expect(worker.consentWorkspace).toMatchObject({ id: workspace.id, slug: workspace.slug });
      expect(worker.workspaceId).toBe(workspace.id);

      const refreshed = await refreshWorker(worker.clientId, worker.refreshToken).expect(201);
      expect(decodeJwt(refreshed.body.access_token).workspace_id).toBe(workspace.id);

      // Consenting from the default workspace still connects there.
      const inDefault = await authorizeWorker(operator);
      expect(inDefault.consentWorkspace.id).toBe(DEFAULT_WORKSPACE_ID);
      expect(inDefault.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    });

    it('refuses approval once another tab switched away from the workspace the screen showed', async () => {
      const workspace = await createWorkspace(operator);
      const inWorkspace = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const { flowId } = await startWorkerFlow();
      const shown = await request(http)
        .get(`/api/v1/auth/consent/${flowId}`)
        .set('Cookie', inWorkspace)
        .expect(200);
      expect(shown.body.workspace.id).toBe(workspace.id);

      // Another tab switches back to the default workspace.
      const switchedBack = cookiesFrom(await switchTo(inWorkspace, DEFAULT_WORKSPACE_ID).expect(200));
      await request(http)
        .post(`/api/v1/auth/authorize/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${VERSION}`)
        .set('Cookie', switchedBack)
        .send({ flow_id: flowId, approved: true, workspace_id: workspace.id })
        .expect(400);
    });

    it('stops a removed member’s worker instead of moving it to another workspace', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const person = await createPerson();
      await request(http)
        .post('/api/v1/workspaces/current/members')
        .set('Cookie', admin)
        .send({ email: person.email, role: WorkspaceRole.MEMBER })
        .expect(201);
      const own = cookiesFrom(await login(person.email, person.password).expect(200));
      const inWorkspace = cookiesFrom(await switchTo(own, workspace.id).expect(200));
      const worker = await authorizeWorker(inWorkspace);
      expect(worker.workspaceId).toBe(workspace.id);

      await request(http)
        .delete(`/api/v1/workspaces/current/members/${person.actorId}`)
        .set('Cookie', admin)
        .expect(204);

      const refused = await refreshWorker(worker.clientId, worker.refreshToken);
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('TOKEN_ACTOR_NOT_IN_WORKSPACE');
    });
  });

  describe('locating a linked row', () => {
    it('says which of your workspaces a task, thread or block is in, and nothing to anyone else', async () => {
      const workspace = await createWorkspace(operator);
      const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
      const task = await request(http)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', admin)
        .send({ name: 'Locate me', description: 'In B', assigneeActorId: operatorActorId })
        .expect(201);
      const thread = await request(http)
        .post('/api/v1/threads')
        .set('Cookie', admin)
        .send({ title: 'Locate me' })
        .expect(201);
      const block = await request(http)
        .post('/api/v1/context/blocks')
        .set('Cookie', admin)
        .send({ title: 'Locate me', content: 'In B' })
        .expect(201);

      const rows = [
        ['task', task.body.id],
        ['thread', thread.body.id],
        ['context_block', block.body.id],
      ];
      for (const [kind, id] of rows) {
        // From the default workspace, the operator is told where it is.
        const located = await request(http)
          .get('/api/v1/workspaces/locate')
          .query({ kind, id })
          .set('Cookie', operator)
          .expect(200);
        expect(located.body).toMatchObject({
          id: workspace.id,
          slug: workspace.slug,
          role: WorkspaceRole.ADMIN,
          current: false,
        });
        await request(http)
          .get('/api/v1/workspaces/locate')
          .query({ kind, id })
          .set('Cookie', admin)
          .expect(200)
          .expect((res) => expect(res.body.current).toBe(true));
      }

      // Someone who is not in that workspace gets the same 404 as a row that does not exist.
      const outsider = await createPerson();
      const outsiderCookies = cookiesFrom(
        await login(outsider.email, outsider.password).expect(200),
      );
      for (const [kind, id] of [...rows, ['task', randomUUID()]]) {
        await request(http)
          .get('/api/v1/workspaces/locate')
          .query({ kind, id })
          .set('Cookie', outsiderCookies)
          .expect(404);
      }
      await request(http)
        .get('/api/v1/workspaces/locate')
        .query({ kind: 'users', id: task.body.id })
        .set('Cookie', operator)
        .expect(400);
    });
  });

  it('creates agents in the caller’s workspace only', async () => {
    const workspace = await createWorkspace(operator);
    const admin = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
    const agent = await request(http)
      .post('/api/v1/agents')
      .set('Cookie', admin)
      .send({ slug: `p4-agent-${unique()}`, name: 'Phase 4 agent', systemPrompt: 'Hi.' })
      .expect(201);
    const memberships = await members.findBy({ actorId: agent.body.actorId });
    expect(memberships.map((m) => m.workspaceId)).toEqual([workspace.id]);
  });

  it('lets the installation operator review access requests from any workspace', async () => {
    const workspace = await createWorkspace(operator);
    const there = cookiesFrom(await switchTo(operator, workspace.id).expect(200));
    await request(http).get('/api/v1/admin/access-requests').set('Cookie', there).expect(200);

    const person = await createPerson();
    const own = cookiesFrom(await login(person.email, person.password).expect(200));
    await request(http).get('/api/v1/admin/access-requests').set('Cookie', own).expect(403);
  });
});
