import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import {
  ensureTestUser,
  getAuthCookies,
} from './helpers/auth.helper';

describe('Agent follow-up prompts (e2e)', () => {
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

  const create = (followUpPrompt?: string) =>
    request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug: `follow-up-${Math.random().toString(36).slice(2, 10)}`,
        name: 'Follow-up Agent',
        systemPrompt: 'Do the work.',
        ...(followUpPrompt === undefined ? {} : { followUpPrompt }),
      })
      .expect(201);

  it('defaults to null, so older clients keep working', async () => {
    const { body } = await create();

    expect(body.followUpPrompt).toBeNull();
  });

  it('stores it on create and returns it to workers by slug', async () => {
    const { body } = await create('Did you put the task in review?');

    const fetched = await request(httpServer)
      .get(`/api/v1/agents/${body.slug}`)
      .set('Cookie', authCookies)
      .expect(200);

    expect(fetched.body.followUpPrompt).toBe(
      'Did you put the task in review?',
    );
  });

  it('can be edited and cleared without touching the system prompt', async () => {
    const { body } = await create('First');
    const patch = (followUpPrompt: string) =>
      request(httpServer)
        .patch(`/api/v1/agents/${body.actorId}`)
        .set('Cookie', authCookies)
        .send({ followUpPrompt })
        .expect(200);

    expect((await patch('Second')).body.followUpPrompt).toBe('Second');

    const cleared = await patch('');
    expect(cleared.body.followUpPrompt).toBe('');
    expect(cleared.body.systemPrompt).toBe('Do the work.');
  });

  it('offers follow-up prompts on the developer template', async () => {
    const { body } = await request(httpServer)
      .get('/api/v1/agents/templates')
      .set('Cookie', authCookies)
      .expect(200);

    const byId = Object.fromEntries(
      body.templates.map((template: { id: string }) => [template.id, template]),
    );
    expect(byId.developer.followUpPrompt).toContain('# Checklist:');
    expect(byId.custom.followUpPrompt).toBeUndefined();
  });
});
