import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AppInitRunner } from '../src/app-init/app-init.runner';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { getConfig } from '../src/config/env.config';
import { ActorType } from '../src/identity-provider/enums';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { McpServerEntity } from '../src/mcp-registry/entities/mcp-server.entity';
import { McpConnectionEntity } from '../src/mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../src/mcp-registry/entities/mcp-scope-mapping.entity';
import { RegisteredClientEntity } from '../src/authorization-server/entities/registered-client.entity';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from '../src/auth-journeys/entities';
import { ConnectionAuthorizationFlowStatus } from '../src/auth-journeys/enums/connection-authorization-flow-status.enum';
import { TokenEndpointAuthMethod } from '../src/authorization-server/enums/token-endpoint-auth-method.enum';
import { GrantType } from '../src/authorization-server/enums/grant-type.enum';
import { ensureAgentActor, ensureTestUser, TEST_USER_SLUG } from './helpers/auth.helper';

const WORKSPACE_B_ID = '44444444-4444-4444-8444-444444444444';
const VERSION = '0.0.0';

/**
 * The OAuth paths that reach MCP registry rows without a workspace in the
 * URL: downstream token exchange and the auth-journeys monitor. A token or
 * session for one workspace must never reach another workspace's
 * connections, downstream tokens or journeys, even by a known UUID, and
 * even on the baseline servers every workspace shares.
 */
describe('Workspace isolation: MCP OAuth token exchange and journeys (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let db: DataSource;
  let actorId: string;
  let tasksServer: McpServerEntity;
  let tasksScope: string;
  let clientId: string;
  const suffix = randomBytes(4).toString('hex');
  const A_DOWNSTREAM_TOKEN = `A_DOWNSTREAM_TOKEN_${suffix}`;
  const B_CANARY = `B_CANARY_${suffix}`;
  // Rows this suite creates, removed afterwards: a connection left on the
  // shared tasks server would make other suites' OAuth flows ask for it.
  const created = { journeys: [] as string[], connections: [] as string[], servers: [] as string[] };

  /** A token as the test user, in a workspace. MCP tokens carry the server and client. */
  async function signToken(
    workspaceId: string,
    overrides: Partial<AccessTokenClaims> = {},
  ): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    return app.get(TokenSignerService).signToken({
      iss: config.issuerUrl,
      sub: actorId,
      workspace_id: workspaceId,
      actor_id: actorId,
      actor_slug: TEST_USER_SLUG,
      actor_type: ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 600,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: 'web-app',
      scope: [],
      resource: config.issuerUrl,
      version: '0.0.0',
      ...overrides,
    });
  }

  const tasksToken = (workspaceId: string, overrides: Partial<AccessTokenClaims> = {}) =>
    signToken(workspaceId, {
      mcp_server_identifier: 'tasks',
      client_id: clientId,
      scope: [tasksScope],
      ...overrides,
    });

  const exchange = (subjectToken: string, resource: string) =>
    request(http)
      .post(`/api/v1/auth/token-exchange/mcp/tasks/${VERSION}`)
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: subjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        resource,
      });

  async function createConnection(
    workspaceId: string,
    serverId: string,
    name: string,
  ): Promise<McpConnectionEntity> {
    const connection = await db.getRepository(McpConnectionEntity).save({
      workspaceId,
      serverId,
      friendlyName: name,
      providedId: name,
      clientId: `${name}-client`,
      clientSecret: `${name}-secret`,
      authorizeUrl: 'https://downstream.invalid/authorize',
      tokenUrl: 'https://downstream.invalid/token',
    });
    created.connections.push(connection.id);
    return connection;
  }

  /** A journey of the test user, for the test client on a server, with authorized connection flows. */
  async function createJourney(
    serverId: string,
    connections: { connection: McpConnectionEntity; accessToken: string }[],
  ): Promise<AuthJourneyEntity> {
    const journey = await db
      .getRepository(AuthJourneyEntity)
      .save({ actorId });
    created.journeys.push(journey.id);
    const client = await db
      .getRepository(RegisteredClientEntity)
      .findOneByOrFail({ clientId });
    await db.getRepository(McpAuthorizationFlowEntity).save({
      authorizationJourneyId: journey.id,
      serverId,
      clientId: client.id,
    });
    for (const { connection, accessToken } of connections) {
      await db.getRepository(ConnectionAuthorizationFlowEntity).save({
        authorizationJourneyId: journey.id,
        mcpConnectionId: connection.id,
        status: ConnectionAuthorizationFlowStatus.AUTHORIZED,
        accessToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    }
    return journey;
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = app.getHttpServer();
    db = app.get(DataSource);

    actorId = await ensureTestUser(app);
    await app.get(AppInitRunner).ensureMcpServers();
    await db
      .getRepository(WorkspaceEntity)
      .createQueryBuilder()
      .insert()
      .values({ id: WORKSPACE_B_ID, slug: 'mcp-oauth-b', name: 'MCP OAuth B' })
      .orIgnore()
      .execute();
    await db
      .getRepository(WorkspaceMemberEntity)
      .createQueryBuilder()
      .insert()
      .values({ workspaceId: WORKSPACE_B_ID, actorId, role: WorkspaceRole.ADMIN })
      .orIgnore()
      .execute();

    tasksServer = await db
      .getRepository(McpServerEntity)
      .findOneByOrFail({ providedId: 'tasks' });
    const [scope] = await db.query(
      `SELECT id FROM mcp_scopes WHERE "serverId" = $1 ORDER BY id LIMIT 1`,
      [tasksServer.id],
    );
    tasksScope = scope.id;

    clientId = `mcp-oauth-client-${suffix}`;
    await db.getRepository(RegisteredClientEntity).save({
      clientId,
      clientSecret: null,
      clientName: `MCP OAuth client ${suffix}`,
      redirectUris: ['http://127.0.0.1/callback'],
      grantTypes: [GrantType.AUTHORIZATION_CODE],
      tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
      scopes: null,
      contacts: null,
    });
  }, 30000);

  afterAll(async () => {
    if (created.journeys.length) {
      await db.query(
        `DELETE FROM connection_authorization_flows WHERE authorization_journey_id = ANY($1)`,
        [created.journeys],
      );
      await db.query(
        `DELETE FROM mcp_authorization_flows WHERE authorization_journey_id = ANY($1)`,
        [created.journeys],
      );
      await db.query(`DELETE FROM authorization_journeys WHERE id = ANY($1)`, [
        created.journeys,
      ]);
    }
    if (created.connections.length) {
      await db.query(`DELETE FROM mcp_scope_mappings WHERE "connectionId" = ANY($1)`, [
        created.connections,
      ]);
      await db.query(`DELETE FROM mcp_connections WHERE id = ANY($1)`, [
        created.connections,
      ]);
    }
    if (created.servers.length) {
      await db.query(`DELETE FROM mcp_servers WHERE id = ANY($1)`, [created.servers]);
    }
    await app.close();
  });

  describe('downstream token exchange on a baseline server', () => {
    let connectionA: McpConnectionEntity;

    beforeAll(async () => {
      // The default workspace (A) connects tasks to a downstream system.
      connectionA = await createConnection(
        DEFAULT_WORKSPACE_ID,
        tasksServer.id,
        `conn-a-${suffix}`,
      );
      await db.getRepository(McpScopeMappingEntity).save({
        workspaceId: DEFAULT_WORKSPACE_ID,
        scopeId: tasksScope,
        serverId: tasksServer.id,
        connectionId: connectionA.id,
        downstreamScope: 'downstream.read',
      });
      await createJourney(tasksServer.id, [
        { connection: connectionA, accessToken: A_DOWNSTREAM_TOKEN },
      ]);
    });

    it("returns the downstream token to the journey's own workspace, person and client", async () => {
      const res = await exchange(
        await tasksToken(DEFAULT_WORKSPACE_ID),
        connectionA.id,
      ).expect(201);
      expect(res.body.access_token).toBe(A_DOWNSTREAM_TOKEN);
    });

    it.each([
      ['UUID', () => connectionA.id],
      ['providedId', () => connectionA.providedId!],
    ])(
      "never gives a B tasks token A's connection, by its %s",
      async (_label, resource) => {
        const res = await exchange(
          await tasksToken(WORKSPACE_B_ID),
          resource(),
        ).expect(404);
        expect(JSON.stringify(res.body)).not.toContain(A_DOWNSTREAM_TOKEN);
      },
    );

    it("never gives another client the person's downstream token", async () => {
      const res = await exchange(
        await tasksToken(DEFAULT_WORKSPACE_ID, { client_id: `other-${suffix}` }),
        connectionA.id,
      ).expect(401);
      expect(JSON.stringify(res.body)).not.toContain(A_DOWNSTREAM_TOKEN);
    });

    it("never gives another member the journey's downstream token", async () => {
      // A member of the same workspace, so the journey check is what refuses.
      const otherActor = await ensureAgentActor(app, `other-member-${suffix}`, 'Other member');
      const res = await exchange(
        await tasksToken(DEFAULT_WORKSPACE_ID, {
          sub: otherActor,
          actor_id: otherActor,
        }),
        connectionA.id,
      ).expect(401);
      expect(JSON.stringify(res.body)).not.toContain(A_DOWNSTREAM_TOKEN);
    });

    it('refuses a token whose person is no longer in the workspace', async () => {
      const notAMember = '55555555-5555-4555-8555-555555555555';
      const res = await exchange(
        await tasksToken(DEFAULT_WORKSPACE_ID, {
          sub: notAMember,
          actor_id: notAMember,
        }),
        connectionA.id,
      ).expect(403);
      expect(res.body.code).toBe('TOKEN_ACTOR_NOT_IN_WORKSPACE');
      expect(JSON.stringify(res.body)).not.toContain(A_DOWNSTREAM_TOKEN);
    });
  });

  describe('auth-journeys monitor', () => {
    let tokenA: string;
    beforeAll(async () => {
      tokenA = await signToken(DEFAULT_WORKSPACE_ID);
    });
    const journeysOf = (serverId: string) =>
      request(http)
        .get(`/api/v1/auth-journeys/servers/${serverId}`)
        .set('Authorization', `Bearer ${tokenA}`);

    it("answers not found for another workspace's server, without its journeys", async () => {
      const serverB = await db.getRepository(McpServerEntity).save({
        workspaceId: WORKSPACE_B_ID,
        providedId: `server-b-${suffix}`,
        name: `Server B ${B_CANARY}`,
        description: 'Owned by B',
      });
      created.servers.push(serverB.id);
      const connectionB = await createConnection(
        WORKSPACE_B_ID,
        serverB.id,
        `conn-b-${B_CANARY}`,
      );
      await createJourney(serverB.id, [
        { connection: connectionB, accessToken: B_CANARY },
      ]);

      const res = await journeysOf(serverB.id).expect(404);
      expect(JSON.stringify(res.body)).not.toContain(B_CANARY);
    });

    it("lists the workspace's own server journeys", async () => {
      const serverA = await db.getRepository(McpServerEntity).save({
        workspaceId: DEFAULT_WORKSPACE_ID,
        providedId: `server-a-${suffix}`,
        name: `Server A ${suffix}`,
        description: 'Owned by A',
      });
      created.servers.push(serverA.id);
      const connection = await createConnection(
        DEFAULT_WORKSPACE_ID,
        serverA.id,
        `conn-own-${suffix}`,
      );
      const journey = await createJourney(serverA.id, [
        { connection, accessToken: 'unused' },
      ]);

      const res = await journeysOf(serverA.id).expect(200);
      const listed = res.body.find((j: { id: string }) => j.id === journey.id);
      expect(listed).toBeDefined();
      expect(listed.connectionAuthorizationFlows).toHaveLength(1);
    });

    it("hides another workspace's connection flows on a baseline server", async () => {
      const ownConnection = await createConnection(
        DEFAULT_WORKSPACE_ID,
        tasksServer.id,
        `conn-base-a-${suffix}`,
      );
      const foreignConnection = await createConnection(
        WORKSPACE_B_ID,
        tasksServer.id,
        `conn-base-b-${B_CANARY}`,
      );
      const journey = await createJourney(tasksServer.id, [
        { connection: ownConnection, accessToken: 'unused' },
        { connection: foreignConnection, accessToken: B_CANARY },
      ]);

      const res = await journeysOf(tasksServer.id).expect(200);
      expect(JSON.stringify(res.body)).not.toContain(B_CANARY);
      const listed = res.body.find((j: { id: string }) => j.id === journey.id);
      expect(listed.connectionAuthorizationFlows).toHaveLength(1);
    });
  });
});
