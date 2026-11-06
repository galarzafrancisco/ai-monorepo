import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { User } from '../src/identity-provider/user.entity';
import { ensureTestUser, getAuthCookies, TEST_USER_EMAIL } from './helpers/auth.helper';

const SOME_ID = '00000000-0000-4000-8000-000000000000';

function scopesFromCookies(cookies: string): string[] {
  const token = cookies
    .split('; ')
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (!token) throw new Error('no access_token cookie');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return payload.scope;
}

describe('Web session scopes E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let adminCookies: string;
  let standardCookies: string;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    const ds = app.get(DataSource);
    await ensureTestUser(app);
    const setRole = (role: 'admin' | 'standard') =>
      ds.getRepository(User).update({ email: TEST_USER_EMAIL }, { role });
    // Scopes are decided at login, so log in once per role.
    await setRole('standard');
    standardCookies = await getAuthCookies(http);
    await setRole('admin');
    adminCookies = await getAuthCookies(http);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('never gives a browser session workers:connect or run:impersonate', () => {
    for (const cookies of [standardCookies, adminCookies]) {
      const scopes = scopesFromCookies(cookies);
      expect(scopes).not.toContain('workers:connect');
      expect(scopes).not.toContain('run:impersonate');
      expect(scopes).toContain('tasks:read');
    }
  });

  it('gives user:admin only to admins', () => {
    expect(scopesFromCookies(standardCookies)).not.toContain('user:admin');
    expect(scopesFromCookies(standardCookies)).toContain('user:standard');
    expect(scopesFromCookies(adminCookies)).toContain('user:admin');
  });

  it.each([
    ['post', `/api/v1/executions/queue/${SOME_ID}/claim`],
    ['post', `/api/v1/executions/active/${SOME_ID}/stop`],
    ['post', `/api/v1/executions/active/${SOME_ID}/unclaim`],
    ['post', `/api/v1/executions/active/${SOME_ID}/github-credentials`],
    ['patch', `/api/v1/executions/active/${SOME_ID}/session`],
    ['patch', `/api/v1/executions/active/${SOME_ID}/tool-calls/increment`],
    ['patch', `/api/v1/executions/active/${SOME_ID}/stats`],
  ] as const)('refuses worker endpoint %s %s for a browser session', async (method, url) => {
    for (const cookies of [standardCookies, adminCookies]) {
      await request(http)[method](url).set('Cookie', cookies).send({}).expect(403);
    }
  });
});
