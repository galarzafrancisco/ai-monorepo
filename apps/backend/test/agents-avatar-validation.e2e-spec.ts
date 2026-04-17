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

describe('Agents Avatar Validation (e2e)', () => {
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

  it('rejects creating an agent with an unmanaged avatar URL', async () => {
    const response = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug: `invalid-avatar-${Math.random().toString(36).slice(2, 10)}`,
        name: 'Invalid Avatar Agent',
        systemPrompt: 'Reject unmanaged avatar URLs.',
        avatarUrl: 'https://example.com/avatar.png',
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.detail).toBe(
      'Avatar URL must be one of the managed agent avatars.',
    );
    expect(response.body.context.avatarUrl).toBe(
      'https://example.com/avatar.png',
    );
  });

  it('rejects updating an agent with an unmanaged avatar URL', async () => {
    const createResponse = await request(httpServer)
      .post('/api/v1/agents')
      .set('Cookie', authCookies)
      .send({
        slug: `managed-avatar-${Math.random().toString(36).slice(2, 10)}`,
        name: 'Managed Avatar Agent',
        systemPrompt: 'Allow only managed avatar URLs.',
        avatarUrl: '/avatar/claude.webp',
      })
      .expect(201);

    const patchResponse = await request(httpServer)
      .patch(`/api/v1/agents/${createResponse.body.actorId}`)
      .set('Cookie', authCookies)
      .send({
        avatarUrl: 'https://example.com/replaced-avatar.png',
      })
      .expect(400);

    expect(patchResponse.body.code).toBe('VALIDATION_FAILED');
    expect(patchResponse.body.detail).toBe(
      'Avatar URL must be one of the managed agent avatars.',
    );
    expect(patchResponse.body.context.avatarUrl).toBe(
      'https://example.com/replaced-avatar.png',
    );
  });
});
