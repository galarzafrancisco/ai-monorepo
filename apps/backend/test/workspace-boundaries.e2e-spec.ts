import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { decodeJwt } from 'jose';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { UserRole } from '../src/identity-provider/enums';
import { WorkspaceRole } from '../src/workspaces/enums';
import { ensureTestUser, getAuthCookies, setTestUserRole } from './helpers/auth.helper';

/**
 * Regressions for the workspace boundary gaps found by attacking live from a
 * second workspace. Each test reproduces one finding.
 * See docs/architecture/workspaces.md, "Invitations" and "Removing a member".
 */

function cookiesFrom(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.map((c: string) => c.split(';')[0].trim()).join('; ');
}

function token(cookies: string): string {
  return cookies.split('; ').find((c) => c.startsWith('access_token='))!.slice('access_token='.length);
}

const unique = () => Math.random().toString(36).slice(2, 10);

describe('Workspace boundaries (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let port: number;
  /** An installation operator, used to create workspaces. */
  let operator: string;

  const login = (email: string, password: string) =>
    request(http).post('/api/v1/auth/login').send({ email, password });
  const switchTo = (cookies: string, workspaceId: string) =>
    request(http).post('/api/v1/auth/web/switch-workspace').set('Cookie', cookies).send({ workspaceId });

  /** A new workspace, and its admin's session in it. */
  async function workspaceWithAdmin(): Promise<{ id: string; admin: string }> {
    const res = await request(http)
      .post('/api/v1/workspaces')
      .set('Cookie', operator)
      .send({ name: `Boundary ${unique()}`, slug: `bnd-${unique()}` })
      .expect(201);
    return { id: res.body.id, admin: cookiesFrom(await switchTo(operator, res.body.id).expect(200)) };
  }

  async function invite(admin: string, email: string, role = WorkspaceRole.MEMBER): Promise<string> {
    const res = await request(http).post('/api/v1/workspaces/current/members').set('Cookie', admin).send({ email, role }).expect(201);
    return res.body.inviteCode;
  }

  async function person() {
    const email = `bnd-${unique()}@example.com`;
    const password = 'password-boundaries';
    const user = await app.get(IdentityProviderService).createUser({
      email, password, slug: `bnd-${unique()}`, displayName: 'Boundary person',
    });
    return { email, password, actorId: user.actorId };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    port = (http as unknown as { address(): { port: number } }).address().port;
    await ensureTestUser(app);
    await setTestUserRole(app, UserRole.ADMIN);
    operator = await getAuthCookies(http);
  });

  afterAll(async () => {
    await setTestUserRole(app, UserRole.STANDARD);
    await app.close();
  });

  describe('invitations', () => {
    it("never let an account pre-claimed under someone's email into a workspace that invites them", async () => {
      // The attacker admins workspace X and A is the victim's company.
      const x = await workspaceWithAdmin();
      const a = await workspaceWithAdmin();
      const secret = await request(http).post('/api/v1/tasks/tasks').set('Cookie', a.admin)
        .send({ name: `A secret ${unique()}`, description: 'only A' }).expect(201);
      const victim = `victim-${unique()}@example.com`;

      // An invite creates no account, so there is nothing to claim by email.
      const xCode = await invite(x.admin, victim);
      await request(http).post('/api/v1/auth/setup-account')
        .send({ email: victim, code: 'guess', password: 'attacker-pass', displayName: 'V', slug: `v-${unique()}` })
        .expect(401);

      // Holding X's code, the attacker creates the victim's account themselves.
      await request(http).post('/api/v1/workspaces/invitations/accept-new-account')
        .send({ code: xCode, password: 'attacker-pass', displayName: 'Victim', slug: `v-${unique()}` })
        .expect(201);
      const attacker = cookiesFrom(await login(victim, 'attacker-pass').expect(200));

      // A invites the real person. That account is not added: it needs A's
      // code, which A gives the person, not the attacker.
      const aCode = await invite(a.admin, victim);
      await switchTo(attacker, a.id).expect(404);
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', attacker).send({ code: xCode }).expect(404);
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', attacker).send({ code: 'guess' }).expect(404);
      await request(http).get(`/api/v1/tasks/tasks/${secret.body.id}`).set('Cookie', attacker).expect(404);

      // Only the code A handed out joins A.
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', attacker).send({ code: aCode }).expect(200);
    });

    it('can only be accepted by an account with the invited email', async () => {
      const w = await workspaceWithAdmin();
      const invited = await person();
      const other = await person();
      const code = await invite(w.admin, invited.email);
      const otherSession = cookiesFrom(await login(other.email, other.password).expect(200));
      const res = await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', otherSession).send({ code }).expect(403);
      expect(res.body.code).toBe('WORKSPACE_INVITATION_EMAIL_MISMATCH');
      // The code is still good for the right person.
      const own = cookiesFrom(await login(invited.email, invited.password).expect(200));
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', own).send({ code }).expect(200);
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', own).send({ code }).expect(404);
    });

    it('are listed and revoked by admins; a revoked code is dead', async () => {
      const w = await workspaceWithAdmin();
      const email = `bnd-rev-${unique()}@example.com`;
      const code = await invite(w.admin, email);
      const list = await request(http).get('/api/v1/workspaces/current/invitations').set('Cookie', w.admin).expect(200);
      const invitation = list.body.find((i: { email: string }) => i.email === email);
      expect(invitation).toBeTruthy();
      expect(JSON.stringify(list.body)).not.toContain(code);
      await request(http).delete(`/api/v1/workspaces/current/invitations/${invitation.id}`).set('Cookie', w.admin).expect(204);
      await request(http).post('/api/v1/workspaces/invitations/preview').send({ code }).expect(404);
    });
  });

  describe('operator-created accounts', () => {
    it('are set up only with the one-time code, never the email alone', async () => {
      const email = `bnd-managed-${unique()}@example.com`;
      const created = await request(http).post('/api/v1/auth/users').set('Cookie', operator)
        .send({ email, role: UserRole.STANDARD }).expect(201);
      expect(created.body.setupUrl).toContain(encodeURIComponent(email));
      const setup = (code?: string) => request(http).post('/api/v1/auth/setup-account')
        .send({ email, ...(code ? { code } : {}), password: 'chosen-password', displayName: 'Managed', slug: `m-${unique()}` });

      await setup().expect(400);
      await setup('wrong-code').expect(401);
      const status = await request(http).post('/api/v1/auth/account-setup-status').send({ email, code: 'wrong-code' }).expect(200);
      expect(status.body.canSetup).toBe(false);
      await setup(created.body.setupCode).expect(200);
      await setup(created.body.setupCode).expect(401);

      // A password reset hands out a new code; the email alone still isn't enough.
      const reset = await request(http).post(`/api/v1/auth/users/${created.body.id}/reset-password`).set('Cookie', operator).expect(200);
      await setup('wrong-code').expect(401);
      await setup(reset.body.setupCode).expect(200);
    });
  });

  describe('removing a member', () => {
    it('ends their access at once: requests, refresh and open sockets', async () => {
      const w = await workspaceWithAdmin();
      const p = await person();
      const code = await invite(w.admin, p.email);
      const own = cookiesFrom(await login(p.email, p.password).expect(200));
      await request(http).post('/api/v1/workspaces/invitations/accept').set('Cookie', own).send({ code }).expect(200);
      const inW = cookiesFrom(await switchTo(own, w.id).expect(200));
      await request(http).get('/api/v1/tasks/tasks').set('Cookie', inW).expect(200);

      const socket: Socket = io(`http://127.0.0.1:${port}/tasks`, {
        transports: ['websocket'], auth: { token: token(inW) }, reconnection: false,
      });
      await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
      const subscribed = await socket.timeout(5000).emitWithAck('tasks.subscribe', {});
      expect(subscribed.ok).toBe(true);
      const disconnected = new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));

      await request(http).delete(`/api/v1/workspaces/current/members/${p.actorId}`).set('Cookie', w.admin).expect(204);

      await disconnected;
      const refused = await request(http).get('/api/v1/tasks/tasks').set('Cookie', inW).expect(403);
      expect(refused.body.code).toBe('WORKSPACE_MEMBERSHIP_REVOKED');
      await request(http).post('/api/v1/tasks/tasks').set('Cookie', inW).send({ name: 'after removal', description: 'x' }).expect(403);
      // A socket opened with the old token is refused too.
      const late: Socket = io(`http://127.0.0.1:${port}/tasks`, {
        transports: ['websocket'], auth: { token: token(inW) }, reconnection: false,
      });
      await new Promise<void>((resolve) => late.on('connect', () => resolve()));
      const lateDisconnected = new Promise<void>((resolve) => late.on('disconnect', () => resolve()));
      late.emit('tasks.subscribe', {});
      await lateDisconnected;
      // Their own workspace list still works, and refresh moves them out.
      await request(http).get('/api/v1/workspaces').set('Cookie', inW).expect(200);
      const refreshed = cookiesFrom(await request(http).post('/api/v1/auth/refresh').set('Cookie', inW).expect(200));
      expect(decodeJwt(token(refreshed)).workspace_id).not.toBe(w.id);
    });
  });

  describe('references to other workspaces and unknown ids', () => {
    it('answer 404 for dependencies, blueprints and thread links, never 500', async () => {
      const a = await workspaceWithAdmin();
      const b = await workspaceWithAdmin();
      const aTask = await request(http).post('/api/v1/tasks/tasks').set('Cookie', a.admin)
        .send({ name: 'A task', description: 'x' }).expect(201);

      const dep = await request(http).post('/api/v1/tasks/tasks').set('Cookie', b.admin)
        .send({ name: 'B', description: 'x', dependsOnIds: [aTask.body.id] }).expect(404);
      expect(dep.body.code).toBe('TASK_NOT_FOUND');
      await request(http).post('/api/v1/task-blueprints').set('Cookie', b.admin)
        .send({ name: 'B bp', description: 'x', dependsOnIds: [aTask.body.id] }).expect(404);
      const bp = await request(http).post('/api/v1/task-blueprints').set('Cookie', b.admin)
        .send({ name: 'B bp', description: 'x' }).expect(201);
      await request(http).patch(`/api/v1/task-blueprints/${bp.body.id}`).set('Cookie', b.admin)
        .send({ dependsOnIds: [aTask.body.id] }).expect(404);

      const thread = await request(http).post('/api/v1/threads').set('Cookie', b.admin).send({ title: 'B thread' }).expect(201);
      const attach = await request(http).post(`/api/v1/threads/${thread.body.id}/tasks`).set('Cookie', b.admin)
        .send({ taskId: aTask.body.id }).expect(404);
      expect(attach.body.code).toBe('TASK_NOT_FOUND');
      const participant = await request(http).post(`/api/v1/threads/${thread.body.id}/participants`).set('Cookie', b.admin)
        .send({ actorId: '11111111-1111-4111-8111-111111111111' }).expect(404);
      expect(participant.body.code).toBe('THREAD_ACTOR_NOT_FOUND');
    });
  });
});
