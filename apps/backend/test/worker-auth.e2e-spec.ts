import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AgentsService } from '../src/agents/agents.service';
import { AppModule } from '../src/app.module';
import {
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_ID,
} from '../src/auth/core/constants/internal-auth-target.constant';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TasksScopes } from '../src/tasks/tasks.scopes';
import {
  ensureTestUser,
  getAuthCookies,
} from './helpers/auth.helper';

describe('Worker Auth (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;

  const agent = {
    slug: `worker-auth-agent-${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Worker Auth Agent',
  };

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
    const agentsService = app.get(AgentsService);
    try {
      await agentsService.getAgentBySlug({ slug: agent.slug });
    } catch {
      await agentsService.createAgent({
        slug: agent.slug,
        name: agent.displayName,
        systemPrompt: 'You are a test agent for worker auth e2e coverage.',
      });
    }
    authCookies = await getAuthCookies(httpServer);
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not expose the internal worker auth target in MCP server listings', async () => {
    const response = await request(httpServer)
      .get('/api/v1/mcp/servers')
      .set('Cookie', authCookies)
      .expect(200);

    const providedIds = response.body.items.map((item: { providedId: string }) => item.providedId);
    expect(providedIds).not.toContain(INTERNAL_WORKER_AUTH_TARGET_ID);
  });

  it('exposes OAuth discovery metadata for the internal worker target', async () => {
    const response = await request(httpServer)
      .get(
        `/.well-known/oauth-authorization-server/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/0.0.0`,
      )
      .expect(200);

    expect(response.body.issuer).toBeDefined();
    expect(response.body.authorization_endpoint).toBeDefined();
    expect(response.body.token_endpoint).toBeDefined();
    expect(response.body.registration_endpoint).toBeDefined();
    expect(response.body.response_types_supported).toEqual(['code']);
    expect(response.body.grant_types_supported).toEqual([
      'authorization_code',
      'refresh_token',
    ]);
    expect(response.body.code_challenge_methods_supported).toEqual(['S256']);

    for (const scope of INTERNAL_WORKER_AUTH_SCOPES) {
      expect(response.body.scopes_supported).toContain(scope.id);
    }
  });

  it('mints a short-lived execution token and uses it to create a task as the agent', async () => {
    const tokenResponse = await request(httpServer)
      .post(`/api/v1/agents/${agent.slug}/execution-token`)
      .set('Cookie', authCookies)
      .send({
        scopes: [TasksScopes.READ.id],
        expirationSeconds: 120,
      })
      .expect(201);

    expect(tokenResponse.body.token).toBeDefined();
    expect(tokenResponse.body.scopes).toEqual([TasksScopes.READ.id]);
    expect(tokenResponse.body.agentSlug).toBe(agent.slug);

    const taskResponse = await request(httpServer)
      .post('/api/v1/tasks/tasks')
      .set('Authorization', `Bearer ${tokenResponse.body.token}`)
      .send({
        name: 'Worker Auth E2E Smoke Task',
        description:
          'Created with an execution token minted from the worker auth flow.',
      })
      .expect(201);

    expect(taskResponse.body.id).toBeDefined();
    expect(taskResponse.body.name).toBe('Worker Auth E2E Smoke Task');
    expect(taskResponse.body.createdByActor.slug).toBe(agent.slug);
  });
});
