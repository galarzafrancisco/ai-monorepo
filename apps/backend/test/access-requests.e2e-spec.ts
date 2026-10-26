import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { User } from '../src/identity-provider/user.entity';
import { AccessRequestEntity } from '../src/access-requests/access-request.entity';
import { ensureTestUser, getAuthCookies, TEST_USER_EMAIL } from './helpers/auth.helper';

describe('Access requests E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let cookies: string;
  let ds: DataSource;

  const setRole = (role: 'admin' | 'standard') =>
    ds.getRepository(User).update({ email: TEST_USER_EMAIL }, { role });
  // Distinct fake IPs so the per-IP limiter doesn't interfere between tests.
  let ipCounter = 0;
  const submit = (body: object) =>
    request(http).post('/api/v1/access-requests').set('X-Forwarded-For', `10.0.0.${++ipCounter}`).send(body);

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    (app as any).set('trust proxy', true);
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(http);
  }, 30000);

  beforeEach(async () => {
    await ds.getRepository(AccessRequestEntity).clear();
    await setRole('admin');
  });

  afterAll(async () => {
    await setRole('admin');
    await app.close();
  });

  it('stores a valid request', async () => {
    await submit({ email: ' Person@Example.com ', building: 'agents' }).expect(202, { received: true });
    const rows = await ds.getRepository(AccessRequestEntity).find();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'Person@Example.com', emailNormalized: 'person@example.com', status: 'new' });
    expect(rows[0].ipHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid and oversized input', async () => {
    await submit({ email: 'nope' }).expect(400);
    await submit({ email: 'a@b.co', building: 'x'.repeat(281) }).expect(400);
    await submit({ email: 'a@b.co', extra: 1 }).expect(400);
    expect(await ds.getRepository(AccessRequestEntity).count()).toBe(0);
  });

  it('treats duplicates identically without leaking and keeps one row', async () => {
    const first = await submit({ email: 'dup@example.com' });
    const second = await submit({ email: 'DUP@example.com', building: 'later' });
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    const rows = await ds.getRepository(AccessRequestEntity).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].submissionCount).toBe(2);
    expect(rows[0].building).toBe('later');
  });

  it('silently drops honeypot submissions', async () => {
    await submit({ email: 'bot@example.com', website: 'http://spam' }).expect(202);
    expect(await ds.getRepository(AccessRequestEntity).count()).toBe(0);
  });

  it('rate limits a single IP', async () => {
    const send = () =>
      request(http).post('/api/v1/access-requests').set('X-Forwarded-For', '192.0.2.99').send({ email: 'r@example.com' });
    for (let i = 0; i < 5; i++) await send().expect(202);
    await send().expect(429);
  });

  it('exposes no anonymous read or write to admin routes', async () => {
    await request(http).get('/api/v1/access-requests').expect(404);
    await request(http).get('/api/v1/admin/access-requests').expect(401);
    await request(http).patch('/api/v1/admin/access-requests/00000000-0000-4000-8000-000000000000').send({ status: 'reviewed' }).expect(401);
    await request(http).delete('/api/v1/admin/access-requests/00000000-0000-4000-8000-000000000000').expect(401);
  });

  it('forbids non-admin users', async () => {
    await setRole('standard');
    await request(http).get('/api/v1/admin/access-requests').set('Cookie', cookies).expect(403);
  });

  it('lets admins list, filter, review and delete', async () => {
    await submit({ email: 'one@example.com', building: 'robots' }).expect(202);
    await submit({ email: 'two@example.com' }).expect(202);

    const list = await request(http).get('/api/v1/admin/access-requests').set('Cookie', cookies).expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items[0].email).toBe('two@example.com'); // newest first
    expect(list.body.items[0]).not.toHaveProperty('ipHash');

    const search = await request(http).get('/api/v1/admin/access-requests?search=robots').set('Cookie', cookies).expect(200);
    expect(search.body.items.map((i: any) => i.email)).toEqual(['one@example.com']);

    const id = search.body.items[0].id;
    const upd = await request(http).patch(`/api/v1/admin/access-requests/${id}`).set('Cookie', cookies).send({ status: 'reviewed' }).expect(200);
    expect(upd.body.status).toBe('reviewed');
    expect(upd.body.reviewedAt).toBeTruthy();

    const reviewed = await request(http).get('/api/v1/admin/access-requests?status=reviewed').set('Cookie', cookies).expect(200);
    expect(reviewed.body.total).toBe(1);

    await request(http).delete(`/api/v1/admin/access-requests/${id}`).set('Cookie', cookies).expect(204);
    await request(http).delete(`/api/v1/admin/access-requests/${id}`).set('Cookie', cookies).expect(404);
  });
});
