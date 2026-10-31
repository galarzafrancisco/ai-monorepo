import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AGENT_DEFINITION_VERSION } from '../src/agents/dto/service/agent-import-export.service.types';
import {
  ensureTestUser,
  getAuthCookies,
} from './helpers/auth.helper';

describe('Agent definition import/export (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;

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

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  });

  afterAll(async () => {
    await app.close();
  });

  const slug = () => `agent-io-${Math.random().toString(36).slice(2, 10)}`;

  const definition = (agentSlug: string, systemPrompt = 'Do the work.') => ({
    slug: agentSlug,
    name: 'Imported Agent',
    type: 'opencode',
    description: 'Portable agent',
    introduction: 'Imports and exports definitions',
    avatarUrl: '/avatar/opencode.svg',
    systemPrompt,
    followUpPrompt: 'Did you put the task in review?',
    providerId: 'xai',
    modelId: 'grok-4',
    statusTriggers: ['NOT_STARTED'],
    tagTriggers: ['code'],
    allowedTools: ['tasks.readTask'],
    isActive: true,
    concurrencyLimit: 3,
    toolPermissions: [],
  });

  const createServer = async () => {
    const response = await request(httpServer)
      .post('/api/v1/mcp/servers')
      .set('Cookie', authCookies)
      .send({
        providedId: `import-tool-${Math.random().toString(36).slice(2, 10)}`,
        name: 'Import Tool',
        description: 'MCP server for agent import export tests',
        type: 'http',
        url: 'http://localhost:3000/test/mcp',
      })
      .expect(201);

    return response.body as { id: string; providedId: string };
  };

  it('exports a portable document without ids, timestamps, or secrets', async () => {
    const agentSlug = slug();
    const server = await createServer();
    await request(httpServer)
      .post(`/api/v1/mcp/servers/${server.id}/scopes`)
      .set('Cookie', authCookies)
      .send([{ id: 'context:read', description: 'Read context' }])
      .expect(201);

    const created = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        ...definition(agentSlug),
        toolPermissions: undefined,
      })
      .expect(201);

    await request(httpServer)
      .put(`/api/v1/agents/${created.body.actorId}/tool-permissions/${server.id}`)
      .set('Cookie', authCookies)
      .send({ scopeIds: ['context:read'] })
      .expect(200);

    const token = await request(httpServer)
      .post(`/api/v1/agents/${agentSlug}/tokens`)
      .set('Cookie', authCookies)
      .send({
        name: 'export-must-not-include-this',
        scopes: ['agents:read'],
      })
      .expect(201);

    const exported = await request(httpServer)
      .get('/api/v1/agents/export')
      .query({ slug: agentSlug })
      .set('Cookie', authCookies)
      .expect(200);

    expect(exported.headers['content-disposition']).toContain('agents-');
    expect(exported.headers['content-disposition']).toContain('.json');
    expect(exported.body.version).toBe(AGENT_DEFINITION_VERSION);
    expect(exported.body.agents).toHaveLength(1);

    const agent = exported.body.agents[0];
    expect(agent.slug).toBe(agentSlug);
    expect(agent.systemPrompt).toBe('Do the work.');
    expect(agent.toolPermissions).toEqual([
      {
        serverProvidedId: server.providedId,
        scopeIds: ['context:read'],
      },
    ]);

    const serialized = JSON.stringify(exported.body);
    expect(agent).not.toHaveProperty('actorId');
    expect(agent).not.toHaveProperty('rowVersion');
    expect(agent).not.toHaveProperty('createdAt');
    expect(serialized).not.toContain(created.body.actorId);
    expect(serialized).not.toContain(server.id);
    expect(serialized).not.toContain(token.body.token);
  });

  it('creates a missing agent and updates an existing one by slug', async () => {
    const agentSlug = slug();
    const created = await request(httpServer)
      .post('/api/v1/agents/import')
      .set('Cookie', authCookies)
      .send({
        version: AGENT_DEFINITION_VERSION,
        agents: [definition(agentSlug)],
      })
      .expect(200);

    expect(created.body.created).toEqual([agentSlug]);
    expect(created.body.updated).toEqual([]);
    expect(created.body.failed).toEqual([]);

    const fetched = await request(httpServer)
      .get(`/api/v1/agents/${agentSlug}`)
      .set('Cookie', authCookies)
      .expect(200);
    expect(fetched.body.systemPrompt).toBe('Do the work.');
    expect(fetched.body.followUpPrompt).toBe('Did you put the task in review?');
    expect(fetched.body.providerId).toBe('xai');

    const updated = await request(httpServer)
      .post('/api/v1/agents/import')
      .set('Cookie', authCookies)
      .send({
        version: AGENT_DEFINITION_VERSION,
        agents: [definition(agentSlug, 'Updated prompt')],
      })
      .expect(200);

    expect(updated.body.created).toEqual([]);
    expect(updated.body.updated).toEqual([agentSlug]);

    const refetched = await request(httpServer)
      .get(`/api/v1/agents/${agentSlug}`)
      .set('Cookie', authCookies)
      .expect(200);
    expect(refetched.body.actorId).toBe(fetched.body.actorId);
    expect(refetched.body.systemPrompt).toBe('Updated prompt');
  });

  it('applies tool grants by provided id and skips servers that are not here', async () => {
    const agentSlug = slug();
    const server = await createServer();
    await request(httpServer)
      .post(`/api/v1/mcp/servers/${server.id}/scopes`)
      .set('Cookie', authCookies)
      .send([{ id: 'tasks:read', description: 'Read tasks' }])
      .expect(201);

    const imported = await request(httpServer)
      .post('/api/v1/agents/import')
      .set('Cookie', authCookies)
      .send({
        version: AGENT_DEFINITION_VERSION,
        agents: [
          {
            ...definition(agentSlug),
            toolPermissions: [
              { serverProvidedId: server.providedId, scopeIds: ['tasks:read'] },
              { serverProvidedId: 'missing-server', scopeIds: ['tasks:write'] },
            ],
          },
        ],
      })
      .expect(200);

    expect(imported.body.created).toEqual([agentSlug]);
    expect(imported.body.warnings).toEqual([
      {
        slug: agentSlug,
        reason:
          "Tool grant for MCP server 'missing-server' was skipped because that server is not in this workspace.",
      },
    ]);

    const agent = await request(httpServer)
      .get(`/api/v1/agents/${agentSlug}`)
      .set('Cookie', authCookies)
      .expect(200);
    const permissions = await request(httpServer)
      .get(`/api/v1/agents/${agent.body.actorId}/tool-permissions`)
      .set('Cookie', authCookies)
      .expect(200);

    const grant = permissions.body.find(
      (item: { server: { providedId: string } }) =>
        item.server.providedId === server.providedId,
    );
    expect(grant.grantedScopes).toEqual([
      { id: 'tasks:read', description: 'Read tasks' },
    ]);
  });

  it('rejects database ids and unknown document versions', async () => {
    const agentSlug = slug();

    await request(httpServer)
      .post('/api/v1/agents/import')
      .set('Cookie', authCookies)
      .send({
        version: AGENT_DEFINITION_VERSION,
        agents: [{ ...definition(agentSlug), actorId: 'not-portable' }],
      })
      .expect(400);

    await request(httpServer)
      .post('/api/v1/agents/import')
      .set('Cookie', authCookies)
      .send({
        version: 99,
        agents: [definition(agentSlug)],
      })
      .expect(400);
  });

  it('returns not found when exporting a missing slug', async () => {
    await request(httpServer)
      .get('/api/v1/agents/export')
      .query({ slug: slug() })
      .set('Cookie', authCookies)
      .expect(404);
  });
});
