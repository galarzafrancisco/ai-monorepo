import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AppInitRunner } from '../src/app-init/app-init.runner';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { McpServerAuthType1763200000000 } from '../src/migrations/1763200000000-McpServerAuthType';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

const VERSION = '0.0.0';
const REDIRECT_URI = 'http://localhost:6274/oauth/callback';
const SCOPE = 'tool:read';

describe('MCP server auth type (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '/.well-known/*path', method: RequestMethod.ALL }],
    });
    await app.init();
    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createServer(
    body: Record<string, unknown> = {},
  ): Promise<{ id: string; providedId: string; authType: string }> {
    const providedId = `auth-type-${randomBytes(4).toString('hex')}`;
    const response = await request(httpServer)
      .post('/api/v1/mcp/servers')
      .set('Cookie', authCookies)
      .send({
        providedId,
        name: providedId,
        description: 'Auth type test server',
        type: 'http',
        url: `http://localhost:3000/${providedId}/mcp`,
        ...body,
      })
      .expect(201);
    await request(httpServer)
      .post(`/api/v1/mcp/servers/${response.body.id}/scopes`)
      .set('Cookie', authCookies)
      .send([{ id: SCOPE, description: 'Read' }])
      .expect(201);
    return response.body;
  }

  function setAuthType(serverId: string, authType: string) {
    return request(httpServer)
      .patch(`/api/v1/mcp/servers/${serverId}`)
      .set('Cookie', authCookies)
      .send({ authType });
  }

  function registerClient(providedId: string) {
    return request(httpServer)
      .post(`/api/v1/auth/clients/register/mcp/${providedId}/${VERSION}`)
      .send({
        client_name: `Auth type test client ${randomBytes(4).toString('hex')}`,
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      });
  }

  function authorize(providedId: string, clientId: string, codeChallenge: string) {
    return request(httpServer)
      .get(`/api/v1/auth/authorize/mcp/${providedId}/${VERSION}`)
      .query({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        state: 'test-state',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
  }

  function consent(providedId: string, flowId: string) {
    return request(httpServer)
      .post(`/api/v1/auth/authorize/mcp/${providedId}/${VERSION}`)
      .set('Cookie', authCookies)
      .send({ flow_id: flowId, approved: true });
  }

  function introspect(providedId: string, token: string) {
    return request(httpServer)
      .post(`/api/v1/auth/introspect/mcp/${providedId}/${VERSION}`)
      .send({ token });
  }

  /** Register a client and start an authorization request; returns the flow. */
  async function startFlow(providedId: string) {
    const client = await registerClient(providedId).expect(201);
    const clientId: string = client.body.client_id;
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const authorizeResponse = await authorize(
      providedId,
      clientId,
      codeChallenge,
    ).expect(302);
    const flowId = new URL(
      authorizeResponse.headers.location,
    ).searchParams.get('flow')!;
    return { clientId, codeVerifier, codeChallenge, flowId };
  }

  describe('migration', () => {
    it('backfills existing servers to Taico auth with a non-null default', async () => {
      // The migration is replayed inside a transaction that is always rolled
      // back, so the shared e2e database (and the auth type of servers other
      // tests created) is left exactly as it was, even if an assertion fails.
      const external = await createServer({ authType: 'external' });

      const migration = new McpServerAuthType1763200000000();
      const queryRunner = dataSource.createQueryRunner();
      const providedId = `legacy-${randomBytes(4).toString('hex')}`;
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await migration.down(queryRunner);
        // A server registered before auth types existed.
        await queryRunner.query(
          `INSERT INTO "mcp_servers" ("providedId", "name", "description", "type", "url") VALUES ($1, $1, 'legacy', 'http', 'http://localhost:3000/legacy/mcp')`,
          [providedId],
        );
        await migration.up(queryRunner);

        const rows: Array<{ authType: string }> = await queryRunner.query(
          `SELECT "authType" FROM "mcp_servers" WHERE "providedId" = $1`,
          [providedId],
        );
        expect(rows[0].authType).toBe('taico');

        const nulls: Array<{ count: string }> = await queryRunner.query(
          `SELECT count(*) FROM "mcp_servers" WHERE "authType" IS NULL`,
        );
        expect(Number(nulls[0].count)).toBe(0);

        const columns: Array<{ is_nullable: string; column_default: string }> =
          await queryRunner.query(
            `SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'mcp_servers' AND column_name = 'authType'`,
          );
        expect(columns[0].is_nullable).toBe('NO');
        expect(columns[0].column_default).toContain('taico');
      } finally {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
      }

      // The rollback left the real data alone.
      const legacy: unknown[] = await dataSource.query(
        `SELECT 1 FROM "mcp_servers" WHERE "providedId" = $1`,
        [providedId],
      );
      expect(legacy).toHaveLength(0);
      const fetched = await request(httpServer)
        .get(`/api/v1/mcp/servers/${external.id}`)
        .set('Cookie', authCookies)
        .expect(200);
      expect(fetched.body.authType).toBe('external');
    });
  });

  describe('registry API', () => {
    it('defaults new servers to Taico auth', async () => {
      const server = await createServer();
      expect(server.authType).toBe('taico');
    });

    it('creates an external server and persists toggles', async () => {
      const server = await createServer({ authType: 'external' });
      expect(server.authType).toBe('external');

      const fetched = await request(httpServer)
        .get(`/api/v1/mcp/servers/${server.id}`)
        .set('Cookie', authCookies)
        .expect(200);
      expect(fetched.body.authType).toBe('external');

      const updated = await setAuthType(server.id, 'taico').expect(200);
      expect(updated.body.authType).toBe('taico');

      // Updating other fields keeps the auth type.
      const renamed = await request(httpServer)
        .patch(`/api/v1/mcp/servers/${server.id}`)
        .set('Cookie', authCookies)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(renamed.body.authType).toBe('taico');
    });

    it('rejects an unknown auth type', async () => {
      const server = await createServer();
      await setAuthType(server.id, 'magic').expect(400);
    });

    it('marks only user-registered servers as switchable', async () => {
      const server = await createServer();
      expect(server).toMatchObject({ requiresTaicoAuth: false });
    });
  });

  describe("Taico's own servers", () => {
    const LOCKED_IDS = ['tasks', 'context', 'taico-worker', 'taico-display'];

    async function getByProvidedId(providedId: string) {
      const response = await request(httpServer)
        .get(`/api/v1/mcp/servers/${providedId}`)
        .set('Cookie', authCookies)
        .expect(200);
      return response.body as {
        id: string;
        authType: string;
        requiresTaicoAuth: boolean;
      };
    }

    it.each(LOCKED_IDS)('reject switching %s to external', async (providedId) => {
      const server = await getByProvidedId(providedId);
      expect(server).toMatchObject({ authType: 'taico', requiresTaicoAuth: true });

      const response = await setAuthType(server.id, 'external').expect(400);
      expect(response.body.code).toBe('SERVER_REQUIRES_TAICO_AUTH');
      expect((await getByProvidedId(providedId)).authType).toBe('taico');

      // Saving taico (or omitting authType) is still allowed.
      await setAuthType(server.id, 'taico').expect(200);
    });

    it('restore a legacy external row to taico on startup', async () => {
      const server = await getByProvidedId('context');
      // A row saved before the registry rejected external for this server.
      await dataSource.query(
        `UPDATE mcp_servers SET "authType" = 'external' WHERE id = $1`,
        [server.id],
      );
      try {
        await app.get(AppInitRunner).ensureMcpServers();
        expect((await getByProvidedId('context')).authType).toBe('taico');
      } finally {
        await dataSource.query(
          `UPDATE mcp_servers SET "authType" = 'taico' WHERE id = $1`,
          [server.id],
        );
      }
    });
  });

  describe('Taico OAuth routes', () => {
    it('serve Taico-auth servers', async () => {
      const server = await createServer();
      await request(httpServer)
        .get(`/.well-known/oauth-authorization-server/mcp/${server.providedId}/${VERSION}`)
        .expect(200);
      await registerClient(server.providedId).expect(201);
    });

    it('are off for external servers, while the registry still serves them', async () => {
      const server = await createServer({ authType: 'external' });

      const metadata = await request(httpServer)
        .get(`/.well-known/oauth-authorization-server/mcp/${server.providedId}/${VERSION}`)
        .expect(404);
      expect(metadata.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');

      const byId = await request(httpServer)
        .get(`/.well-known/oauth-authorization-server/mcp/${server.id}/${VERSION}`)
        .expect(404);
      expect(byId.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');

      const registration = await registerClient(server.providedId).expect(404);
      expect(registration.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');

      const exchange = await request(httpServer)
        .post(`/api/v1/auth/token-exchange/mcp/${server.providedId}/${VERSION}`)
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'not-a-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          resource: 'anything',
        });
      expect(exchange.status).toBe(404);
      expect(exchange.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');

      // Ordinary registry reads are unaffected.
      const scopes = await request(httpServer)
        .get(`/api/v1/mcp/servers/${server.id}/scopes`)
        .set('Cookie', authCookies)
        .expect(200);
      expect(scopes.body.map((s: { id: string }) => s.id)).toContain(SCOPE);
    });

    it('stop authorizing and redeeming once a server switches to external', async () => {
      const server = await createServer();
      const client = await registerClient(server.providedId).expect(201);
      const clientId: string = client.body.client_id;
      const codeVerifier = randomBytes(32).toString('base64url');
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

      const authorizeResponse = await authorize(server.providedId, clientId, codeChallenge).expect(302);
      const flowId = new URL(authorizeResponse.headers.location).searchParams.get('flow');
      const consent = await request(httpServer)
        .post(`/api/v1/auth/authorize/mcp/${server.providedId}/${VERSION}`)
        .set('Cookie', authCookies)
        .send({ flow_id: flowId, approved: true })
        .expect(302);
      const code = new URL(consent.headers.location).searchParams.get('code');
      expect(code).toBeTruthy();

      await setAuthType(server.id, 'external').expect(200);

      const blocked = await authorize(server.providedId, clientId, codeChallenge).expect(404);
      expect(blocked.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');

      const token = await request(httpServer)
        .post(`/api/v1/auth/token/mcp/${server.providedId}/${VERSION}`)
        .send({
          grant_type: 'authorization_code',
          client_id: clientId,
          code: code!,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        });
      expect(token.status).toBe(404);
      expect(token.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');
      expect(token.body.access_token).toBeUndefined();
    });

    it('refuse to finish a consent flow begun before the switch to external', async () => {
      const server = await createServer();
      const { flowId } = await startFlow(server.providedId);

      await setAuthType(server.id, 'external').expect(200);

      const response = await consent(server.providedId, flowId);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('SERVER_USES_EXTERNAL_AUTH');
      expect(response.headers.location).toBeUndefined();
    });

    it('stop introspecting tokens as active after the switch to external', async () => {
      const server = await createServer();
      const { clientId, codeVerifier, flowId } = await startFlow(
        server.providedId,
      );
      const approved = await consent(server.providedId, flowId).expect(302);
      const code = new URL(approved.headers.location).searchParams.get('code');
      const token = await request(httpServer)
        .post(`/api/v1/auth/token/mcp/${server.providedId}/${VERSION}`)
        .send({
          grant_type: 'authorization_code',
          client_id: clientId,
          code: code!,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        });
      expect(token.status).toBeLessThan(300);
      const accessToken: string = token.body.access_token;
      expect(accessToken).toBeTruthy();

      const before = await introspect(server.providedId, accessToken);
      expect(before.body.active).toBe(true);

      await setAuthType(server.id, 'external').expect(200);

      const after = await introspect(server.providedId, accessToken);
      expect(after.body).toEqual({ active: false });

      // Switching back restores Taico's view of its own token.
      await setAuthType(server.id, 'taico').expect(200);
      const restored = await introspect(server.providedId, accessToken);
      expect(restored.body.active).toBe(true);
    });
  });
});
