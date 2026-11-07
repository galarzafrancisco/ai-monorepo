import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { ALL_WEB_SCOPES } from '../src/auth/core/scopes/all-web.scopes';
import { UserScopes } from '../src/auth/core/scopes/user.scopes';
import { getConfig } from '../src/config/env.config';
import { ActorType, UserRole } from '../src/identity-provider/enums';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { AiModelJob, AiProviderConnectionStatus } from '../src/ai-providers/enums';
import { ChatgptConnectionsService } from '../src/ai-providers/chatgpt-subscription/chatgpt-connections.service';
import {
  ensureTestUser,
  getAuthCookies,
  setTestUserRole,
  TEST_USER_SLUG,
} from './helpers/auth.helper';

/** A second workspace. The test user is an admin of both; `member` is only in B. */
const WORKSPACE_B_ID = '55555555-5555-4555-8555-555555555555';
const PREFIX = '/api/v1';

/**
 * Workspaces phase 3d: AI providers, model selections, secrets and ChatGPT
 * plan connections belong to a workspace. A workspace admin sets them up;
 * every member's threads use them; a non-admin cannot change them; another
 * workspace cannot see or use them.
 */
describe('Workspace AI models and secrets (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let db: DataSource;
  let adminActorId: string;
  let memberActorId: string;
  let memberSlug: string;
  let fake: Server;
  let baseUrl: string;
  const suffix = randomBytes(4).toString('hex');
  const KEY_A = `sk-a-${suffix}`;
  const KEY_B = `sk-b-${suffix}`;
  /** The Authorization header of every completion request the fake model received. */
  const seenKeys: string[] = [];

  let adminA: string;
  let adminB: string;
  let memberB: string;
  const a: { secret?: string; provider?: string } = {};
  const b: { secret?: string; provider?: string } = {};

  /** A token like the web session a person gets in a workspace. */
  async function sign(
    workspaceId: string,
    options: { actorId: string; slug: string; admin: boolean },
  ): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: options.actorId,
      workspace_id: workspaceId,
      actor_id: options.actorId,
      actor_slug: options.slug,
      actor_type: ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 1800,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: 'web-app',
      scope: [
        ...ALL_WEB_SCOPES.map((scope) => scope.id),
        options.admin ? UserScopes.ADMIN.id : UserScopes.STANDARD.id,
      ],
      resource: config.issuerUrl,
      version: '0.0.0',
    };
    return app.get(TokenSignerService).signToken(claims);
  }

  const call = (token: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) =>
    request(http)[method](`${PREFIX}${path}`).set('Authorization', `Bearer ${token}`);

  /** Sets up a provider with its own key and the conversation model, as that workspace's admin. */
  async function setUpModels(token: string, key: string, into: typeof a): Promise<void> {
    into.provider = (
      await call(token, 'post', '/ai-providers')
        .send({ name: `Shared name ${suffix}`, type: 'openai_compatible', baseUrl })
        .expect(201)
    ).body.id;
    await call(token, 'patch', `/ai-providers/${into.provider}`).send({ apiKey: key }).expect(200);
    into.secret = (await call(token, 'get', `/ai-providers/${into.provider}`).expect(200)).body.secretId;
    await call(token, 'put', '/ai-model-selections/user_small_tasks')
      .send({ aiProviderId: into.provider, modelId: `model-${suffix}` })
      .expect(200);
  }

  beforeAll(async () => {
    // API keys are stored as secrets, which need encrypted storage.
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
    delete process.env.ALLOW_PLAINTEXT_SECRETS_INSECURE;
    process.env.CHATGPT_SUBSCRIPTION_ENABLED = 'true';

    // An OpenAI-compatible model that answers with a title naming the key it was called with.
    fake = createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        const authorization = req.headers.authorization ?? '';
        seenKeys.push(authorization);
        const title = authorization === `Bearer ${KEY_B}` ? 'Bravo workspace title' : 'Alpha workspace title';
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'chatcmpl-1',
            object: 'chat.completion',
            created: 0,
            model: `model-${suffix}`,
            choices: [{ index: 0, message: { role: 'assistant', content: title }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1`;

    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = app.getHttpServer();
    db = app.get(DataSource);

    adminActorId = await ensureTestUser(app);
    memberSlug = `ai-member-${suffix}`;
    memberActorId = (
      await app.get(IdentityProviderService).createUser({
        email: `${memberSlug}@example.com`,
        displayName: 'AI member',
        password: `pw-${suffix}-long-enough`,
        slug: memberSlug,
      })
    ).actorId;

    await db
      .getRepository(WorkspaceEntity)
      .createQueryBuilder()
      .insert()
      .values({ id: WORKSPACE_B_ID, slug: 'ai-models-b', name: 'AI models B' })
      .orIgnore()
      .execute();
    const members = db.getRepository(WorkspaceMemberEntity);
    await members
      .createQueryBuilder()
      .insert()
      .values([
        { workspaceId: WORKSPACE_B_ID, actorId: adminActorId, role: WorkspaceRole.ADMIN },
        { workspaceId: WORKSPACE_B_ID, actorId: memberActorId, role: WorkspaceRole.MEMBER },
      ])
      .orIgnore()
      .execute();
    // The member only belongs to B.
    await members.delete({ workspaceId: DEFAULT_WORKSPACE_ID, actorId: memberActorId });

    adminA = await sign(DEFAULT_WORKSPACE_ID, { actorId: adminActorId, slug: TEST_USER_SLUG, admin: true });
    adminB = await sign(WORKSPACE_B_ID, { actorId: adminActorId, slug: TEST_USER_SLUG, admin: true });
    memberB = await sign(WORKSPACE_B_ID, { actorId: memberActorId, slug: memberSlug, admin: false });

    await setUpModels(adminA, KEY_A, a);
    await setUpModels(adminB, KEY_B, b);
  }, 60000);

  afterAll(async () => {
    try {
      await call(adminA, 'delete', '/ai-model-selections/user_small_tasks').expect(204);
      await call(adminA, 'delete', `/ai-providers/${a.provider}`).expect(204);
    } finally {
      await app?.close();
      await new Promise((resolve) => fake.close(resolve));
      delete process.env.CHATGPT_SUBSCRIPTION_ENABLED;
    }
  });

  describe("a member uses the workspace's model", () => {
    it("names a member's thread with B's model and key, and an A thread with A's", async () => {
      const taskB = (
        await call(memberB, 'post', '/tasks/tasks').send({ name: `B task ${suffix}`, description: 'b' }).expect(201)
      ).body;
      const before = seenKeys.length;
      const threadB = (await call(memberB, 'post', '/threads').send({ parentTaskId: taskB.id }).expect(201)).body;
      expect(threadB.title).toBe('Bravo workspace title');
      expect(seenKeys.slice(before)).toEqual([`Bearer ${KEY_B}`]);

      const taskA = (
        await call(adminA, 'post', '/tasks/tasks').send({ name: `A task ${suffix}`, description: 'a' }).expect(201)
      ).body;
      const threadA = (await call(adminA, 'post', '/threads').send({ parentTaskId: taskA.id }).expect(201)).body;
      expect(threadA.title).toBe('Alpha workspace title');
      expect(seenKeys.slice(before)).toEqual([`Bearer ${KEY_B}`, `Bearer ${KEY_A}`]);
    });

    it("lets a member see which model the workspace uses, and only that workspace's", async () => {
      const providers = (await call(memberB, 'get', '/ai-providers').expect(200)).body;
      expect(providers.map((p: { id: string }) => p.id)).toEqual([b.provider]);
      const selections = (await call(memberB, 'get', '/ai-model-selections').expect(200)).body;
      expect(selections.find((s: { job: string }) => s.job === 'user_small_tasks')).toMatchObject({
        aiProviderId: b.provider,
        isReady: true,
      });
      // The conversation is not selected in B, whatever A selected.
      expect(selections.find((s: { job: string }) => s.job === 'conversation')).toMatchObject({
        aiProviderId: null,
      });
    });

    it('resolves each workspace to its own selection', async () => {
      const factory = app.get(ChatModelFactory);
      const resolvedB = await factory.resolve({ workspaceId: WORKSPACE_B_ID, job: AiModelJob.USER_SMALL_TASKS });
      expect(resolvedB.modelId).toBe(`model-${suffix}`);
      // A thread's own provider must be one of its workspace's.
      await expect(
        factory.resolve({
          workspaceId: WORKSPACE_B_ID,
          job: AiModelJob.CONVERSATION,
          aiProviderId: a.provider,
          modelId: 'x',
        }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_NOT_FOUND' });
      await expect(
        factory.resolve({ workspaceId: WORKSPACE_B_ID, job: AiModelJob.CONVERSATION }),
      ).rejects.toMatchObject({ code: 'AI_MODEL_NOT_SELECTED' });
    });
  });

  describe('a member who is not an admin cannot change it', () => {
    const forbidden = (req: request.Test) => req.expect(403);

    it('refuses every change to providers, selections and secrets', async () => {
      await forbidden(
        call(memberB, 'post', '/ai-providers').send({ name: 'Mine', type: 'openai_compatible', baseUrl }),
      );
      await forbidden(call(memberB, 'patch', `/ai-providers/${b.provider}`).send({ apiKey: 'sk-mine' }));
      await forbidden(call(memberB, 'delete', `/ai-providers/${b.provider}`));
      await forbidden(
        call(memberB, 'put', '/ai-model-selections/conversation').send({ aiProviderId: b.provider, modelId: 'mine' }),
      );
      await forbidden(call(memberB, 'delete', '/ai-model-selections/user_small_tasks'));
      await forbidden(call(memberB, 'post', '/secrets').send({ name: `mine-${suffix}`, value: 'v' }));
      await forbidden(call(memberB, 'get', `/secrets/${b.secret}/value`));
      await forbidden(call(memberB, 'patch', `/secrets/${b.secret}`).send({ value: 'v' }));
      await forbidden(call(memberB, 'delete', `/secrets/${b.secret}`));

      // Nothing changed.
      const selection = (await call(adminB, 'get', '/ai-model-selections').expect(200)).body.find(
        (s: { job: string }) => s.job === 'user_small_tasks',
      );
      expect(selection).toMatchObject({ aiProviderId: b.provider, modelId: `model-${suffix}` });
      const value = (await call(adminB, 'get', `/secrets/${b.secret}/value`).expect(200)).body.value;
      expect(value).toBe(KEY_B);
    });

    it('refuses a standard web session, whose scopes come from the membership role', async () => {
      await setTestUserRole(app, UserRole.STANDARD);
      try {
        const cookies = await getAuthCookies(http);
        await request(http)
          .put(`${PREFIX}/ai-model-selections/conversation`)
          .set('Cookie', cookies)
          .send({ aiProviderId: a.provider, modelId: 'x' })
          .expect(403);
        await request(http).get(`${PREFIX}/ai-model-selections`).set('Cookie', cookies).expect(200);

        await setTestUserRole(app, UserRole.ADMIN);
        const adminCookies = await getAuthCookies(http);
        await request(http)
          .put(`${PREFIX}/ai-model-selections/system_small_tasks`)
          .set('Cookie', adminCookies)
          .send({ aiProviderId: a.provider, modelId: 'admin-choice' })
          .expect(200);
        await request(http)
          .delete(`${PREFIX}/ai-model-selections/system_small_tasks`)
          .set('Cookie', adminCookies)
          .expect(204);
      } finally {
        await setTestUserRole(app, UserRole.STANDARD);
      }
    });
  });

  describe("another workspace cannot see or use the first one's providers or secrets", () => {
    it('lists none of them and answers 404 for their ids', async () => {
      const listed = JSON.stringify((await call(adminB, 'get', '/ai-providers').expect(200)).body);
      expect(listed).not.toContain(a.provider);
      const secrets = JSON.stringify((await call(adminB, 'get', '/secrets').expect(200)).body);
      expect(secrets).not.toContain(a.secret);

      await call(adminB, 'get', `/ai-providers/${a.provider}`).expect(404);
      await call(adminB, 'get', `/ai-providers/${a.provider}/models`).expect(404);
      await call(adminB, 'patch', `/ai-providers/${a.provider}`).send({ name: 'stolen' }).expect(404);
      await call(adminB, 'delete', `/ai-providers/${a.provider}`).expect(404);
      await call(adminB, 'get', `/secrets/${a.secret}`).expect(404);
      await call(adminB, 'get', `/secrets/${a.secret}/value`).expect(404);
      await call(adminB, 'patch', `/secrets/${a.secret}`).send({ value: 'stolen' }).expect(404);
      await call(adminB, 'delete', `/secrets/${a.secret}`).expect(404);
    });

    it("cannot select A's provider or attach A's secret", async () => {
      await call(adminB, 'put', '/ai-model-selections/conversation')
        .send({ aiProviderId: a.provider, modelId: 'stolen' })
        .expect(404);
      await call(adminB, 'post', '/ai-providers')
        .send({ name: 'Borrowed key', type: 'openai_compatible', baseUrl, secretId: a.secret })
        .expect(404);
      await call(adminB, 'patch', `/ai-providers/${b.provider}`).send({ secretId: a.secret }).expect(404);

      // A is untouched: its key, provider and selection are as A left them.
      expect((await call(adminA, 'get', `/secrets/${a.secret}/value`).expect(200)).body.value).toBe(KEY_A);
      expect((await call(adminA, 'get', `/ai-providers/${a.provider}`).expect(200)).body).toMatchObject({
        name: `Shared name ${suffix}`,
        secretId: a.secret,
      });
      const [selection] = await db.query(
        `SELECT ai_provider_id FROM ai_model_selections WHERE workspace_id = $1 AND job = 'user_small_tasks'`,
        [DEFAULT_WORKSPACE_ID],
      );
      expect(selection.ai_provider_id).toBe(a.provider);
    });

    it('keeps names unique per workspace, not across them', async () => {
      // Both providers' keys were stored under the same secret name, one in each workspace.
      const [names] = await db.query(
        `SELECT count(DISTINCT workspace_id)::int AS n FROM secrets WHERE id = ANY($1::uuid[]) AND name = $2`,
        [[a.secret, b.secret], `Shared name ${suffix} API Key`],
      );
      expect(names.n).toBe(2);
      const conflict = await call(adminB, 'post', '/secrets')
        .send({ name: `Shared name ${suffix} API Key`, value: 'v' })
        .expect(409);
      expect(conflict.body.code).toBe('SECRET_NAME_CONFLICT');
    });
  });

  describe("a ChatGPT plan connection stays the person's, inside one workspace", () => {
    let planB: string;
    let connectionId: string;

    beforeAll(async () => {
      planB = (
        await call(adminB, 'post', '/ai-providers').send({ name: 'ChatGPT', type: 'chatgpt_subscription' }).expect(201)
      ).body.id;
      // The member connected their own account in B (the OAuth flow is covered in chatgpt-subscription).
      const [user] = await db.query(`SELECT id FROM users WHERE actor_id = $1`, [memberActorId]);
      const [row] = await db.query(
        `INSERT INTO ai_provider_connections (workspace_id, ai_provider_id, user_id, status, row_version)
         VALUES ($1, $2, $3, $4, 1) RETURNING id`,
        [WORKSPACE_B_ID, planB, user.id, AiProviderConnectionStatus.CONNECTED],
      );
      connectionId = row.id;
    });

    afterAll(async () => {
      await db.query(`DELETE FROM ai_provider_connections WHERE id = $1`, [connectionId]);
      await call(adminB, 'delete', `/ai-providers/${planB}`).expect(204);
    });

    it("pays only for the member's own turns in B", async () => {
      const connections = app.get(ChatgptConnectionsService);
      await expect(
        connections.authorizeTurn(WORKSPACE_B_ID, planB, { actorId: memberActorId, automated: false }),
      ).resolves.toEqual({ connectionId });
      // Someone else in B has no connection of their own; the member's is never used for them.
      await expect(
        connections.authorizeTurn(WORKSPACE_B_ID, planB, { actorId: adminActorId, automated: false }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_CONNECTION_REQUIRED' });
      // A turn in A cannot reach B's provider.
      await expect(
        connections.authorizeTurn(DEFAULT_WORKSPACE_ID, planB, { actorId: memberActorId, automated: false }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_NOT_FOUND' });
    });

    it('is not used once the person is no longer a member of the workspace', async () => {
      const members = db.getRepository(WorkspaceMemberEntity);
      await members.delete({ workspaceId: WORKSPACE_B_ID, actorId: memberActorId });
      try {
        await expect(
          app
            .get(ChatgptConnectionsService)
            .authorizeTurn(WORKSPACE_B_ID, planB, { actorId: memberActorId, automated: false }),
        ).rejects.toMatchObject({ code: 'AI_PROVIDER_CONNECTION_REQUIRED' });
      } finally {
        await members.insert({ workspaceId: WORKSPACE_B_ID, actorId: memberActorId, role: WorkspaceRole.MEMBER });
      }
    });

    it("answers 404 for B's plan provider from A", async () => {
      await call(adminA, 'get', `/ai-providers/${planB}/connection`).expect(404);
      await call(adminA, 'post', `/ai-providers/${planB}/connection/authorize`).expect(404);
      const own = (await call(memberB, 'get', `/ai-providers/${planB}/connection`).expect(200)).body;
      expect(own).toMatchObject({ aiProviderId: planB, status: 'connected' });
    });
  });
});
