import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppInitRunner } from '../src/app-init/app-init.runner';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

describe('Actor deletion (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;

  const slug = `leaver-${Math.random().toString(36).slice(2, 10)}`;
  let agentActorId: string;
  let taskId: string;

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

    const agent = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug,
        name: 'Leaver',
        systemPrompt: 'Works on a task, then gets deleted.',
      })
      .expect(201);
    agentActorId = agent.body.actorId;

    const task = await request(httpServer)
      .post('/api/v1/tasks/tasks')
      .set('Cookie', authCookies)
      .send({
        name: 'Task owned by a soon-to-be-deleted agent',
        description: 'Must survive the deletion of its assignee',
        assigneeActorId: agentActorId,
      })
      .expect(201);
    taskId = task.body.id;

    await request(httpServer)
      .delete(`/api/v1/agents/${agentActorId}`)
      .set('Cookie', authCookies)
      .expect(204);
  });

  afterAll(async () => {
    await app.close();
  });

  it('removes the agent from agent lookups', async () => {
    await request(httpServer)
      .get(`/api/v1/agents/${slug}`)
      .set('Cookie', authCookies)
      .expect(404);

    const list = await request(httpServer)
      .get('/api/v1/agents?limit=100')
      .set('Cookie', authCookies)
      .expect(200);
    expect(
      list.body.items.map((agent: { actorId: string }) => agent.actorId),
    ).not.toContain(agentActorId);
  });

  it('keeps the task and shows its assignee as a deleted actor', async () => {
    const task = await request(httpServer)
      .get(`/api/v1/tasks/tasks/${taskId}`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(task.body.assigneeActor.id).toBe(agentActorId);
    expect(task.body.assigneeActor.displayName).toBe('Leaver');
    expect(task.body.assigneeActor.deletedAt).toEqual(expect.any(String));
  });

  it('lists the deleted actor for attribution but leaves it out of search', async () => {
    const actors = await request(httpServer)
      .get('/api/v1/actors')
      .set('Cookie', authCookies)
      .expect(200);
    const listed = actors.body.find(
      (actor: { id: string }) => actor.id === agentActorId,
    );
    expect(listed.deletedAt).toEqual(expect.any(String));

    const search = await request(httpServer)
      .get('/api/v1/actors/search')
      .query({ query: 'Leaver', threshold: 0 })
      .set('Cookie', authCookies)
      .expect(200);
    expect(
      search.body.map((actor: { id: string }) => actor.id),
    ).not.toContain(agentActorId);
  });

  it('refuses to assign new work to the deleted actor', async () => {
    const task = await request(httpServer)
      .post('/api/v1/tasks/tasks')
      .set('Cookie', authCookies)
      .send({ name: 'Fresh task', description: 'Not for a deleted agent' })
      .expect(201);

    await request(httpServer)
      .patch(`/api/v1/tasks/tasks/${task.body.id}/assign`)
      .set('Cookie', authCookies)
      .send({ assigneeActorId: agentActorId })
      .expect(404);
  });

  it('frees the slug for a new agent', async () => {
    const recreated = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug,
        name: 'Leaver Two',
        systemPrompt: 'Takes over the slug.',
      })
      .expect(201);

    expect(recreated.body.actorId).not.toBe(agentActorId);
  });

  it('refuses to delete the agent thread chat depends on', async () => {
    const taico = await request(httpServer)
      .get('/api/v1/agents/taico')
      .set('Cookie', authCookies)
      .expect(200);

    const response = await request(httpServer)
      .delete(`/api/v1/agents/${taico.body.actorId}`)
      .set('Cookie', authCookies)
      .expect(409);
    expect(response.body.code).toBe('AGENT_DELETION_NOT_ALLOWED');
  });

  it('does not bring a deleted built-in agent back on restart', async () => {
    const builtIn = await request(httpServer)
      .get('/api/v1/agents/code-reviewer')
      .set('Cookie', authCookies)
      .expect(200);
    await request(httpServer)
      .delete(`/api/v1/agents/${builtIn.body.actorId}`)
      .set('Cookie', authCookies)
      .expect(204);

    await app.get(AppInitRunner).ensureAgents();

    await request(httpServer)
      .get('/api/v1/agents/code-reviewer')
      .set('Cookie', authCookies)
      .expect(404);
  });
});
