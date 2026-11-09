import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { decodeJwt } from 'jose';
import { io } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AuthGuardsModule } from '../src/auth/guards/auth-guards.module';
import { AccessTokenGuard } from '../src/auth/guards/guards/access-token.guard';
import { WsAccessTokenGuard } from '../src/auth/guards/guards/ws-access-token-guard';
import { CurrentWorkspace } from '../src/auth/guards/decorators/current-workspace.decorator';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { getConfig } from '../src/config/env.config';
import { ActorType, UserRole } from '../src/identity-provider/enums';
import { User } from '../src/identity-provider/user.entity';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import {
  ensureTestUser,
  getAuthCookies,
  setTestUserRole,
  TEST_USER_EMAIL,
  TEST_USER_SLUG,
} from './helpers/auth.helper';
import { WorkspaceAccess } from '../src/auth/guards/decorators/workspace-access.decorator';

/** Not a real workspace: nothing is scoped yet, so no row is needed. */
const OTHER_WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';

/** Echoes the request's workspace, as a controller would read it. */
@Controller('workspace-probe')
@UseGuards(AccessTokenGuard)
@WorkspaceAccess('scoped')
class WorkspaceProbeController {
  @Get()
  get(@CurrentWorkspace() workspaceId: string) {
    return { workspaceId };
  }
}

/** A route that forgot to declare how it keeps workspaces apart. */
@Controller('workspace-probe-undeclared')
@UseGuards(AccessTokenGuard)
class UndeclaredProbeController {
  @Get()
  get() {
    return { reached: true };
  }
}

/** Echoes the socket's workspace, as a gateway handler would read it. */
@WebSocketGateway({ namespace: '/workspace-probe' })
@UseGuards(WsAccessTokenGuard)
@WorkspaceAccess('scoped')
class WorkspaceProbeGateway {
  @SubscribeMessage('probe')
  probe(@CurrentWorkspace() workspaceId: string) {
    return { workspaceId };
  }
}

@Module({
  imports: [AuthGuardsModule],
  controllers: [WorkspaceProbeController, UndeclaredProbeController],
  providers: [WorkspaceProbeGateway],
})
class WorkspaceProbeModule {}

function accessTokenFrom(cookies: string): string {
  const token = cookies
    .split('; ')
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (!token) throw new Error('no access_token cookie');
  return token;
}

describe('Workspace request context (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let port: number;
  let actorId: string;
  let members: Repository<WorkspaceMemberEntity>;
  let users: Repository<User>;
  let originalRole: UserRole;

  /** A first-party token for the test user, with or without the claim. */
  async function signToken(workspaceId?: string): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: actorId,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      actor_id: actorId,
      actor_slug: TEST_USER_SLUG,
      actor_type: ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 300,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: 'web-app',
      scope: ['tasks:read'],
      resource: config.issuerUrl,
      version: '0.0.0',
    };
    return app.get(TokenSignerService).signToken(claims);
  }

  async function workspaceOverHttp(token: string): Promise<string> {
    const res = await request(http)
      .get('/api/v1/workspace-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.workspaceId;
  }

  async function workspaceOverSocket(token: string): Promise<string> {
    const socket = io(`http://127.0.0.1:${port}/workspace-probe`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      const ack = await socket.timeout(5000).emitWithAck('probe', {});
      return ack.workspaceId;
    } finally {
      socket.disconnect();
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule, WorkspaceProbeModule],
    }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    port = (app.getHttpServer().address() as { port: number }).port;
    actorId = await ensureTestUser(app);
    members = app.get(getRepositoryToken(WorkspaceMemberEntity));
    users = app.get(getRepositoryToken(User));
    originalRole = (await users.findOneByOrFail({ email: TEST_USER_EMAIL }))
      .role as UserRole;
    // Requests are checked against membership, so the other workspace has to
    // exist and the test user has to be in it.
    await app.get<Repository<WorkspaceEntity>>(getRepositoryToken(WorkspaceEntity))
      .upsert({ id: OTHER_WORKSPACE_ID, slug: 'request-context-other', name: 'Request context other' }, ['id']);
    await members.upsert(
      { workspaceId: OTHER_WORKSPACE_ID, actorId, role: WorkspaceRole.MEMBER },
      ['workspaceId', 'actorId'],
    );
  }, 30000);

  afterAll(async () => {
    // Put both roles back in step, as other suites expect.
    await setTestUserRole(app, originalRole);
    await app.close();
  });

  describe('workspace from the token', () => {
    it('uses the workspace_id claim when present', async () => {
      const token = await signToken(OTHER_WORKSPACE_ID);
      expect(await workspaceOverHttp(token)).toBe(OTHER_WORKSPACE_ID);
      expect(await workspaceOverSocket(token)).toBe(OTHER_WORKSPACE_ID);
    });

    it('falls back to the default workspace when the claim is missing', async () => {
      const token = await signToken();
      expect(decodeJwt(token).workspace_id).toBeUndefined();
      expect(await workspaceOverHttp(token)).toBe(DEFAULT_WORKSPACE_ID);
      expect(await workspaceOverSocket(token)).toBe(DEFAULT_WORKSPACE_ID);
    });

    it('gives a web session the default workspace', async () => {
      const token = accessTokenFrom(await getAuthCookies(http));
      expect(await workspaceOverHttp(token)).toBe(DEFAULT_WORKSPACE_ID);
    });

    it('refuses an authenticated route with no @WorkspaceAccess mode', async () => {
      const res = await request(http)
        .get('/api/v1/workspace-probe-undeclared')
        .set('Authorization', `Bearer ${await signToken()}`)
        .expect(500);
      expect(res.body.code).toBe('WORKSPACE_ACCESS_UNDECLARED');
    });
  });

  describe('user:admin follows the membership role, installation:admin users.role', () => {
    /** Sets users.role and the membership role, which are independent. */
    async function setRoles(userRole: UserRole, memberRole: WorkspaceRole) {
      await users.update({ email: TEST_USER_EMAIL }, { role: userRole });
      await members.update(
        { actorId, workspaceId: DEFAULT_WORKSPACE_ID },
        { role: memberRole },
      );
    }

    it('gives user:admin to a workspace admin who is not an installation admin', async () => {
      await setRoles(UserRole.STANDARD, WorkspaceRole.ADMIN);
      const cookies = await getAuthCookies(http);
      const scopes = decodeJwt(accessTokenFrom(cookies)).scope as string[];
      expect(scopes).toContain('user:admin');
      expect(scopes).not.toContain('user:standard');
      expect(scopes).not.toContain('installation:admin');
      // A workspace admin route works; an installation operator route does not.
      await request(http)
        .patch(`/api/v1/workspaces/current/members/${actorId}`)
        .set('Cookie', cookies)
        .send({ role: WorkspaceRole.ADMIN })
        .expect(200);
      await request(http)
        .get('/api/v1/admin/access-requests')
        .set('Cookie', cookies)
        .expect(403);
    });

    it('withholds user:admin from a workspace member who is an installation admin', async () => {
      await setRoles(UserRole.ADMIN, WorkspaceRole.MEMBER);
      const cookies = await getAuthCookies(http);
      const scopes = decodeJwt(accessTokenFrom(cookies)).scope as string[];
      expect(scopes).not.toContain('user:admin');
      expect(scopes).toContain('user:standard');
      expect(scopes).toContain('installation:admin');
      await request(http)
        .patch(`/api/v1/workspaces/current/members/${actorId}`)
        .set('Cookie', cookies)
        .send({ role: WorkspaceRole.MEMBER })
        .expect(403);
      await request(http)
        .get('/api/v1/admin/access-requests')
        .set('Cookie', cookies)
        .expect(200);
    });

    it('keeps the same scopes as before for a single workspace', async () => {
      // The test helper sets both roles, as an admin script would.
      await setTestUserRole(app, UserRole.STANDARD);
      let scopes = decodeJwt(accessTokenFrom(await getAuthCookies(http)))
        .scope as string[];
      expect(scopes).not.toContain('user:admin');

      await setTestUserRole(app, UserRole.ADMIN);
      scopes = decodeJwt(accessTokenFrom(await getAuthCookies(http)))
        .scope as string[];
      expect(scopes).toContain('user:admin');
    });
  });
});
