import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { UserRole } from '../src/identity-provider/enums';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

describe('Workspaces (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let testUserActorId: string;
  let members: Repository<WorkspaceMemberEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '/.well-known/*path', method: RequestMethod.ALL }],
    });
    await app.init();
    httpServer = app.getHttpServer();

    testUserActorId = await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
    members = app.get(getRepositoryToken(WorkspaceMemberEntity));
  });

  afterAll(async () => {
    await app.close();
  });

  it('has the default workspace', async () => {
    const workspaces = app.get<Repository<WorkspaceEntity>>(
      getRepositoryToken(WorkspaceEntity),
    );
    const workspace = await workspaces.findOneBy({ id: DEFAULT_WORKSPACE_ID });
    expect(workspace?.slug).toBe('default');
  });

  it('puts a new person in the default workspace and signs it into their session token', async () => {
    // Other suites sharing this database may add the test user to more
    // workspaces, so look for the default membership itself.
    const membership = await members.findOneBy({
      actorId: testUserActorId,
      workspaceId: DEFAULT_WORKSPACE_ID,
    });
    expect(membership).not.toBeNull();

    const accessToken = authCookies
      .split('; ')
      .find((c) => c.startsWith('access_token='))
      ?.slice('access_token='.length);
    expect(accessToken).toBeDefined();
    expect(decodeJwt(accessToken!).workspace_id).toBe(DEFAULT_WORKSPACE_ID);
  });

  it('puts a new agent in the default workspace as a member', async () => {
    const agent = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug: `ws-agent-${Math.random().toString(36).slice(2, 10)}`,
        name: 'Workspace agent',
        systemPrompt: 'Belongs to a workspace.',
      })
      .expect(201);

    const membership = await members.findOneBy({ actorId: agent.body.actorId });
    expect(membership?.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(membership?.role).toBe(WorkspaceRole.MEMBER);
  });

  it('puts a new person in the workspace they are created in, and users.role no longer changes it', async () => {
    const identity = app.get(IdentityProviderService);
    const user = await identity.createManagedUser({
      email: `ws-${Math.random().toString(36).slice(2, 10)}@example.com`,
      role: UserRole.ADMIN,
    });

    // Created with no workspace given: the default one, as its admin.
    expect(await members.findBy({ actorId: user.actorId })).toEqual([
      expect.objectContaining({
        workspaceId: DEFAULT_WORKSPACE_ID,
        role: WorkspaceRole.ADMIN,
      }),
    ]);

    // users.role is the installation role only.
    await identity.updateUserRole(user.id, { role: UserRole.STANDARD });
    expect((await members.findOneBy({ actorId: user.actorId }))?.role).toBe(
      WorkspaceRole.ADMIN,
    );
  });

  it('adds actors from before workspaces with no membership, once, at startup, in batches', async () => {
    // A database whose app last ran before workspaces: the backfill has not
    // run and its actors have no membership.
    const dataSource = app.get(DataSource);
    const identity = app.get(IdentityProviderService);
    const admin = await identity.createManagedUser({
      email: `ws-old-${Math.random().toString(36).slice(2, 10)}@example.com`,
      role: UserRole.ADMIN,
    });
    const people = [admin.actorId];
    for (let i = 0; i < 2; i++) {
      const user = await identity.createManagedUser({
        email: `ws-old-${Math.random().toString(36).slice(2, 10)}@example.com`,
        role: UserRole.STANDARD,
      });
      people.push(user.actorId);
    }
    for (const actorId of people) {
      await members.delete({ actorId });
    }
    await dataSource.query(
      `UPDATE workspaces SET members_backfilled_at = NULL WHERE id = $1`,
      [DEFAULT_WORKSPACE_ID],
    );

    // Three missing actors with a batch size of two crosses a batch boundary.
    const batchSize = WorkspacesService.BACKFILL_BATCH_SIZE;
    WorkspacesService.BACKFILL_BATCH_SIZE = 2;
    try {
      await app.get(WorkspacesService).onModuleInit();
    } finally {
      WorkspacesService.BACKFILL_BATCH_SIZE = batchSize;
    }

    expect((await members.findOneBy({ actorId: admin.actorId }))?.role).toBe(
      WorkspaceRole.ADMIN,
    );
    for (const actorId of people) {
      expect(await members.findBy({ actorId })).toEqual([
        expect.objectContaining({ workspaceId: DEFAULT_WORKSPACE_ID }),
      ]);
    }
    const [{ members_backfilled_at }] = await dataSource.query(
      `SELECT members_backfilled_at FROM workspaces WHERE id = $1`,
      [DEFAULT_WORKSPACE_ID],
    );
    expect(members_backfilled_at).not.toBeNull();
  });

  it('keeps a person removed from every workspace out across restarts, even one from before workspaces', async () => {
    const unique = () => Math.random().toString(36).slice(2, 10);
    const email = `ws-removed-${unique()}@example.com`;
    const password = 'password-ws-removed';
    const user = await app.get(IdentityProviderService).createUser({
      email,
      password,
      slug: `ws-removed-${unique()}`,
      displayName: 'Removed person',
    });
    // Older than the default workspace, like a person from before phase 1.
    await app.get(DataSource).query(
      `UPDATE actors SET created_at = (SELECT created_at FROM workspaces WHERE id = $1) - interval '1 day' WHERE id = $2`,
      [DEFAULT_WORKSPACE_ID, user.actorId],
    );
    const workspaces = app.get(WorkspacesService);
    await workspaces.removeMember(DEFAULT_WORKSPACE_ID, user.actorId);

    const login = () =>
      request(httpServer).post('/api/v1/auth/login').send({ email, password });
    expect((await login().expect(403)).body.code).toBe('NO_WORKSPACE_MEMBERSHIP');

    await workspaces.onModuleInit();
    await workspaces.onModuleInit();

    expect(await members.countBy({ actorId: user.actorId })).toBe(0);
    expect((await login().expect(403)).body.code).toBe('NO_WORKSPACE_MEMBERSHIP');
  });
});
