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
import { AccessRequestEntity } from '../src/access-requests/access-request.entity';
import { ensureTestUser, getAuthCookies, TEST_USER_EMAIL } from './helpers/auth.helper';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Access requests E2E', () => {
  let app: INestApplication<App>;
  let http: App;
  let ds: DataSource;
  let adminCookies: string;
  let standardCookies: string;

  const setRole = (role: 'admin' | 'standard') =>
    ds.getRepository(User).update({ email: TEST_USER_EMAIL }, { role });
  const rows = () => ds.getRepository(AccessRequestEntity).find();
  const submit = (body: object) => request(http).post('/api/v1/access-requests').send(body);
  const admin = {
    list: (qs = '') => request(http).get(`/api/v1/admin/access-requests${qs}`).set('Cookie', adminCookies),
  };

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ensureTestUser(app);
    // The admin scope is decided at login, so log in once per role.
    await setRole('standard');
    standardCookies = await getAuthCookies(http);
    await setRole('admin');
    adminCookies = await getAuthCookies(http);
  }, 30000);

  beforeEach(async () => {
    await ds.getRepository(AccessRequestEntity).clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores a valid request and confirms only after storing', async () => {
    await submit({ email: ' Person@Example.com ', building: ' agents ' }).expect(201, { received: true });
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      email: 'Person@Example.com',
      emailNormalized: 'person@example.com',
      building: 'agents',
      heardFrom: null,
      heardFromOther: null,
      status: 'new',
      submissionCount: 1,
    });
  });

  it('rejects invalid, oversized and unknown input without storing anything', async () => {
    await submit({}).expect(400);
    await submit({ email: 'nope' }).expect(400);
    await submit({ email: `${'a'.repeat(250)}@b.co` }).expect(400);
    await submit({ email: 'a@b.co', building: 'x'.repeat(281) }).expect(400);
    await submit({ email: 'a@b.co', building: 42 }).expect(400);
    await submit({ email: 'a@b.co', role: 'admin' }).expect(400);
    await submit({ email: 'a@b.co', heardFrom: 'myspace' }).expect(400);
    await submit({ email: 'a@b.co', heardFrom: 7 }).expect(400);
    await submit({ email: 'a@b.co', heardFrom: 'other', heardFromOther: 'x'.repeat(121) }).expect(400);
    await submit({ email: 'a@b.co', heardFrom: 'other', heardFromOther: ['x'] }).expect(400);
    expect(await rows()).toHaveLength(0);
  });

  it('stores where the visitor heard about Taico', async () => {
    await submit({ email: 'x@example.com', heardFrom: 'x' }).expect(201);
    await submit({ email: 'shirt@example.com', heardFrom: 'conference_tshirt' }).expect(201);
    await submit({ email: 'other@example.com', heardFrom: 'other', heardFromOther: '  a podcast  ' }).expect(201);
    await submit({ email: 'blank@example.com', heardFrom: 'other', heardFromOther: '   ' }).expect(201);
    // "Other" text is dropped unless "other" is the chosen source.
    await submit({ email: 'mixed@example.com', heardFrom: 'linkedin', heardFromOther: 'ignored' }).expect(201);
    await submit({ email: 'orphan@example.com', heardFromOther: 'ignored' }).expect(201);
    await submit({ email: 'max@example.com', heardFrom: 'other', heardFromOther: 'y'.repeat(120) }).expect(201);

    const byEmail = Object.fromEntries((await rows()).map((r) => [r.email, [r.heardFrom, r.heardFromOther]]));
    expect(byEmail).toEqual({
      'x@example.com': ['x', null],
      'shirt@example.com': ['conference_tshirt', null],
      'other@example.com': ['other', 'a podcast'],
      'blank@example.com': ['other', null],
      'mixed@example.com': ['linkedin', null],
      'orphan@example.com': [null, null],
      'max@example.com': ['other', 'y'.repeat(120)],
    });
  });

  it('enforces "other" text only alongside the "other" source in the database', async () => {
    await expect(
      ds.query(
        `INSERT INTO "access_requests" ("email", "email_normalized", "heard_from", "heard_from_other")
         VALUES ('db@example.com', 'db@example.com', 'x', 'nope')`,
      ),
    ).rejects.toThrow(/CHK_access_requests_heard_from_other/);
  });

  it('updates the source on a repeat only when a new one is given', async () => {
    await submit({ email: 'src@example.com', heardFrom: 'other', heardFromOther: 'a meetup' }).expect(201);
    await submit({ email: 'SRC@example.com' }).expect(201);
    let [row] = await rows();
    expect([row.heardFrom, row.heardFromOther]).toEqual(['other', 'a meetup']);
    await submit({ email: 'src@example.com', heardFrom: 'word_of_mouth' }).expect(201);
    [row] = await rows();
    expect([row.heardFrom, row.heardFromOther]).toEqual(['word_of_mouth', null]);
  });

  it('collapses duplicates into one row and answers identically', async () => {
    const first = await submit({ email: 'dup@example.com', building: 'first' });
    const second = await submit({ email: 'DUP@example.com' });
    const third = await submit({ email: 'dup@example.com', building: 'later' });
    for (const res of [second, third]) {
      expect(res.status).toBe(first.status);
      expect(res.body).toEqual(first.body);
    }
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0].submissionCount).toBe(3);
    expect(stored[0].building).toBe('later');
  });

  it('silently drops honeypot submissions with the same response', async () => {
    await submit({ email: 'bot@example.com', website: 'http://spam' }).expect(201, { received: true });
    expect(await rows()).toHaveLength(0);
  });

  it('exposes no anonymous read and rejects anonymous admin calls', async () => {
    await request(http).get('/api/v1/access-requests').expect(404);
    await request(http).get('/api/v1/admin/access-requests').expect(401);
    await request(http).patch(`/api/v1/admin/access-requests/${MISSING_ID}`).send({ status: 'reviewed' }).expect(401);
    await request(http).delete(`/api/v1/admin/access-requests/${MISSING_ID}`).expect(401);
  });

  it('forbids logged-in non-admin users from reading or changing requests', async () => {
    await submit({ email: 'private@example.com' }).expect(201);
    const [row] = await rows();
    const list = await request(http).get('/api/v1/admin/access-requests').set('Cookie', standardCookies).expect(403);
    expect(JSON.stringify(list.body)).not.toContain('private@example.com');
    await request(http)
      .patch(`/api/v1/admin/access-requests/${row.id}`)
      .set('Cookie', standardCookies)
      .send({ status: 'reviewed' })
      .expect(403);
    await request(http).delete(`/api/v1/admin/access-requests/${row.id}`).set('Cookie', standardCookies).expect(403);
    expect(await rows()).toHaveLength(1);
  });

  it('lets admins list, search, filter, review and delete', async () => {
    await submit({ email: 'one@example.com', building: 'robots 100%' }).expect(201);
    await submit({ email: 'two@example.com', heardFrom: 'other', heardFromOther: 'Hacker News' }).expect(201);

    const list = await admin.list().expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((i: { email: string }) => i.email)).toEqual(['two@example.com', 'one@example.com']);
    expect(Object.keys(list.body.items[0]).sort()).toEqual(
      [
        'building',
        'createdAt',
        'email',
        'heardFrom',
        'heardFromOther',
        'id',
        'lastSubmittedAt',
        'reviewedAt',
        'status',
        'submissionCount',
      ].sort(),
    );
    expect(list.body.items[0]).toMatchObject({ heardFrom: 'other', heardFromOther: 'Hacker News' });
    expect(list.body.items[1]).toMatchObject({ heardFrom: null, heardFromOther: null });
    expect((await admin.list('?search=hacker').expect(200)).body.items.map((i: { email: string }) => i.email)).toEqual([
      'two@example.com',
    ]);

    const search = await admin.list('?search=ROBOTS').expect(200);
    expect(search.body.items.map((i: { email: string }) => i.email)).toEqual(['one@example.com']);
    // LIKE wildcards in the search term are matched literally.
    expect((await admin.list('?search=%25').expect(200)).body.total).toBe(1);

    const id = search.body.items[0].id;
    const reviewed = await request(http)
      .patch(`/api/v1/admin/access-requests/${id}`)
      .set('Cookie', adminCookies)
      .send({ status: 'reviewed' })
      .expect(200);
    expect(reviewed.body).toMatchObject({ status: 'reviewed' });
    expect(reviewed.body.reviewedAt).toBeTruthy();

    expect((await admin.list('?status=reviewed').expect(200)).body.total).toBe(1);
    expect((await admin.list('?status=new').expect(200)).body.items[0].email).toBe('two@example.com');
    await admin.list('?status=bogus').expect(400);

    const reopened = await request(http)
      .patch(`/api/v1/admin/access-requests/${id}`)
      .set('Cookie', adminCookies)
      .send({ status: 'new' })
      .expect(200);
    expect(reopened.body.reviewedAt).toBeNull();

    await request(http).delete(`/api/v1/admin/access-requests/${id}`).set('Cookie', adminCookies).expect(204);
    await request(http).delete(`/api/v1/admin/access-requests/${id}`).set('Cookie', adminCookies).expect(404);
    await request(http)
      .patch(`/api/v1/admin/access-requests/${MISSING_ID}`)
      .set('Cookie', adminCookies)
      .send({ status: 'reviewed' })
      .expect(404);
  });

  it('orders by most recent submission so a retried older request moves to the top', async () => {
    await submit({ email: 'old@example.com' }).expect(201);
    await submit({ email: 'newer@example.com' }).expect(201);
    await submit({ email: 'OLD@example.com' }).expect(201);
    const list = await admin.list().expect(200);
    expect(list.body.items.map((i: { email: string }) => i.email)).toEqual(['old@example.com', 'newer@example.com']);
  });
});
