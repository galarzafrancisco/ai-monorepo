import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AgentsService } from '../src/agents/agents.service';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import {
  ensureTestUser,
  getAuthCookies,
} from './helpers/auth.helper';

describe('Agent Tool Permissions (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let agentsService: AgentsService;

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
      exclude: [
        {
          path: '/.well-known/*path',
          method: RequestMethod.ALL,
        },
      ],
    });

    await app.init();
    httpServer = app.getHttpServer();
    agentsService = app.get(AgentsService);

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  });

  afterAll(async () => {
    await app.close();
  });

  const createAgent = async () => {
    const slug = `agent-tool-perms-${Math.random().toString(36).slice(2, 10)}`;
    return agentsService.createAgent({
      slug,
      name: `Agent ${slug}`,
      systemPrompt: 'You are a test agent for tool permission e2e coverage.',
    });
  };

  const createHttpServer = async () => {
    const response = await request(httpServer)
      .post('/api/v1/mcp/servers')
      .set('Cookie', authCookies)
      .send({
        providedId: `http-tool-${Math.random().toString(36).slice(2, 10)}`,
        name: 'HTTP Test Tool',
        description: 'HTTP MCP server for agent tool permission e2e tests',
        type: 'http',
        url: 'http://localhost:3000/test/mcp',
      })
      .expect(201);

    return response.body as { id: string; providedId: string; name: string };
  };

  const createStdioServer = async () => {
    const response = await request(httpServer)
      .post('/api/v1/mcp/servers')
      .set('Cookie', authCookies)
      .send({
        providedId: `stdio-tool-${Math.random().toString(36).slice(2, 10)}`,
        name: 'STDIO Test Tool',
        description: 'STDIO MCP server for agent tool permission e2e tests',
        type: 'stdio',
        cmd: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      })
      .expect(201);

    return response.body as { id: string; providedId: string; name: string };
  };

  const createScopes = async (
    serverId: string,
    scopes: Array<{ id: string; description: string }>,
  ) => {
    await request(httpServer)
      .post(`/api/v1/mcp/servers/${serverId}/scopes`)
      .set('Cookie', authCookies)
      .send(scopes)
      .expect(201);
  };

  it('creates and lists a scoped tool permission assignment', async () => {
    const agent = await createAgent();
    const server = await createHttpServer();
    await createScopes(server.id, [
      { id: 'context:read', description: 'Read context' },
      { id: 'context:write', description: 'Write context' },
    ]);

    const upsertResponse = await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: ['context:read'],
      })
      .expect(200);

    expect(upsertResponse.body.server.id).toBe(server.id);
    expect(upsertResponse.body.server.providedId).toBe(server.providedId);
    expect(upsertResponse.body.availableScopes).toHaveLength(2);
    expect(upsertResponse.body.grantedScopes).toEqual([
      {
        id: 'context:read',
        description: 'Read context',
      },
    ]);
    expect(upsertResponse.body.hasAllScopes).toBe(false);

    const listResponse = await request(httpServer)
      .get(`/api/v1/agents/${agent.actorId}/tool-permissions`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].server.id).toBe(server.id);
    expect(listResponse.body[0].grantedScopes).toEqual([
      {
        id: 'context:read',
        description: 'Read context',
      },
    ]);
  });

  it('deduplicates granted scope ids and reports all scopes when all are granted', async () => {
    const agent = await createAgent();
    const server = await createHttpServer();
    await createScopes(server.id, [
      { id: 'tasks:read', description: 'Read tasks' },
      { id: 'tasks:write', description: 'Write tasks' },
    ]);

    const response = await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: ['tasks:write', 'tasks:read', 'tasks:read'],
      })
      .expect(200);

    expect(response.body.grantedScopes).toHaveLength(2);
    expect(response.body.grantedScopes).toEqual(
      expect.arrayContaining([
        {
          id: 'tasks:read',
          description: 'Read tasks',
        },
        {
          id: 'tasks:write',
          description: 'Write tasks',
        },
      ]),
    );
    expect(response.body.hasAllScopes).toBe(true);
  });

  it('allows assigning an unscoped stdio tool with no scope ids', async () => {
    const agent = await createAgent();
    const server = await createStdioServer();

    const response = await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: [],
      })
      .expect(200);

    expect(response.body.server.id).toBe(server.id);
    expect(response.body.availableScopes).toEqual([]);
    expect(response.body.grantedScopes).toEqual([]);
    expect(response.body.hasAllScopes).toBe(false);
  });

  it('rejects scopes that do not belong to the target server', async () => {
    const agent = await createAgent();
    const server = await createHttpServer();
    await createScopes(server.id, [
      { id: 'local:read', description: 'Read local server data' },
    ]);

    const response = await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: ['context:read'],
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.context.serverId).toBe(server.id);
    expect(response.body.context.invalidScopeIds).toEqual(['context:read']);
  });

  it('deletes an existing assignment', async () => {
    const agent = await createAgent();
    const server = await createHttpServer();
    await createScopes(server.id, [
      { id: 'tasks:read', description: 'Read tasks' },
    ]);

    await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: ['tasks:read'],
      })
      .expect(200);

    await request(httpServer)
      .delete(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .expect(204);

    const listResponse = await request(httpServer)
      .get(`/api/v1/agents/${agent.actorId}/tool-permissions`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body).toEqual([]);
  });

  it('prevents deleting an MCP server that still has agent permission assignments', async () => {
    const agent = await createAgent();
    const server = await createHttpServer();

    await request(httpServer)
      .put(`/api/v1/agents/${agent.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({
        scopeIds: [],
      })
      .expect(200);

    const response = await request(httpServer)
      .delete(`/api/v1/mcp/servers/${server.id}`)
      .set('Cookie', authCookies)
      .expect(409);

    expect(response.body.code).toBe('SERVER_HAS_DEPENDENCIES');
    expect(response.body.context.serverId).toBe(server.id);
  });
});
