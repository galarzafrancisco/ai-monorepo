import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
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

  it('does not put actors with no membership back in the default workspace at startup', async () => {
    const identity = app.get(IdentityProviderService);
    const user = await identity.createManagedUser({
      email: `ws-removed-${Math.random().toString(36).slice(2, 10)}@example.com`,
      role: UserRole.STANDARD,
    });
    await members.delete({ actorId: user.actorId });

    await app.get(WorkspacesService).onModuleInit();

    expect(await members.countBy({ actorId: user.actorId })).toBe(0);
  });
});
