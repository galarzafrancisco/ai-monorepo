import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { jsonSchema, tool } from 'ai';
import { AppModule } from '../src/app.module';
import { getConfig } from '../src/config/env.config';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AgentsService } from '../src/agents/agents.service';
import { AiModelJob } from '../src/ai-providers/enums';
import { ActorType } from '../src/identity-provider/enums';
import { ChatgptConnectionsService } from '../src/ai-providers/chatgpt-subscription/chatgpt-connections.service';
import { CHATGPT_SUBSCRIPTION_ENDPOINTS } from '../src/ai-providers/chatgpt-subscription/chatgpt-subscription.constants';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import { ChatService } from '../src/threads/chat.service';
import { ThreadTitleService } from '../src/threads/thread-title.service';
import { ChatModelFactory } from '../src/threads/agent/chat-model.factory';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { ThreadAgentResponseDeltaEvent } from '../src/threads/events/threads.events';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import {
  failedResponse,
  FakeOpenAi,
  textResponse,
  toolCallResponse,
} from './helpers/fake-openai';

const ALICE = { subject: 'user-alice', email: 'alice@chatgpt.example' };
const BOB = { subject: 'user-bob', email: 'bob@chatgpt.example' };
const BOB_LOGIN = { email: 'bob@example.com', password: 'bobpassword' };

/**
 * Sign in with ChatGPT end to end against a fake OpenAI: the OAuth flow, token
 * storage and rotation, per-person isolation, and real Threads turns.
 *
 * The tests share one provider and build on each other, in order.
 */
describe('Sign in with ChatGPT E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let dataSource: DataSource;
  let fake: FakeOpenAi;
  let aliceCookies: string;
  let bobCookies: string;
  let aliceActorId: string;
  let bobActorId: string;
  let agentActorId: string;
  let providerId: string;
  const fetchedTasks: unknown[] = [];

  const api = (
    cookies: string,
    method: 'post' | 'patch' | 'get' | 'put' | 'delete',
    path: string,
  ) => request(httpServer)[method](`/api/v1${path}`).set('Cookie', cookies);

  const connectionPath = () => `/ai-providers/${providerId}/connection`;

  const startSignIn = async (cookies: string): Promise<string> =>
    (await api(cookies, 'post', `${connectionPath()}/authorize`).expect(201))
      .body.authorizationUrl;

  /** The whole sign-in, with the person approving at the fake OpenAI. */
  const connect = async (
    cookies: string,
    account: { subject: string; email: string; scope?: string },
  ) => {
    const callbackUrl = fake.approve(await startSignIn(cookies), account);
    return api(cookies, 'post', `${connectionPath()}/callback`).send({
      callbackUrl,
    });
  };

  const connectionRow = async (actorId: string) => {
    const [row] = await dataSource.query(
      `SELECT c.* FROM ai_provider_connections c JOIN users u ON u.id = c.user_id
        WHERE u.actor_id = $1 AND c.ai_provider_id = $2`,
      [actorId, providerId],
    );
    return row as Record<string, any> | undefined;
  };

  const expireAccessToken = (actorId: string) =>
    dataSource.query(
      `UPDATE ai_provider_connections SET access_token_expires_at = now() - interval '1 minute'
        WHERE user_id = (SELECT id FROM users WHERE actor_id = $1)`,
      [actorId],
    );

  const createThread = async (cookies: string): Promise<string> =>
    (
      await api(cookies, 'post', '/threads')
        .send({ title: 'Plan thread' })
        .expect(201)
    ).body.id;

  const sendMessage = (cookies: string, threadId: string, content: string) =>
    api(cookies, 'post', `/threads/${threadId}/messages`)
      .send({ content })
      .expect(201);

  const waitForAgentReplies = async (
    threadId: string,
    count: number,
  ): Promise<string[]> => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows: Array<{ content: string }> = await dataSource.query(
        `SELECT content FROM thread_messages
          WHERE thread_id = $1 AND created_by_actor_id = $2 ORDER BY created_at ASC`,
        [threadId, agentActorId],
      );
      const running: unknown[] = await dataSource.query(
        `SELECT 1 FROM thread_turns WHERE thread_id = $1 AND status = 'running'`,
        [threadId],
      );
      if (rows.length >= count && running.length === 0) {
        return rows.map((row) => row.content);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${count} agent replies`);
  };

  const inputText = (body: Record<string, any>): string =>
    JSON.stringify(body.input);

  beforeAll(async () => {
    process.env.SECRETS_ENABLED = 'true';
    process.env.SECRETS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
    delete process.env.ALLOW_PLAINTEXT_SECRETS_INSECURE;
    delete process.env.CHATGPT_SUBSCRIPTION_ENABLED;

    fake = new FakeOpenAi();
    await fake.start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CHATGPT_SUBSCRIPTION_ENDPOINTS)
      .useValue(fake.endpoints)
      .overrideProvider(TaicoMcpToolsFactory)
      .useValue({
        open: async () => ({
          tools: {
            tasks__fetch: tool({
              description: 'Fetch a task by id',
              inputSchema: jsonSchema<{ taskId: string }>({
                type: 'object',
                properties: { taskId: { type: 'string' } },
                required: ['taskId'],
              }),
              execute: async (input) => {
                fetchedTasks.push(input);
                return { name: 'Ship it', status: 'IN_PROGRESS' };
              },
            }),
          },
          close: async () => undefined,
        }),
      })
      .compile();

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
    app.setGlobalPrefix('api/v1');
    await app.init();
    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);

    aliceActorId = await ensureTestUser(app);
    aliceCookies = await getAuthCookies(httpServer);

    const bob = await app.get(IdentityProviderService).createUser({
      email: BOB_LOGIN.email,
      displayName: 'Bob',
      password: BOB_LOGIN.password,
      slug: 'bob',
    });
    bobActorId = bob.actorId;
    const login = await request(httpServer)
      .post('/api/v1/auth/login')
      .send(BOB_LOGIN)
      .expect(200);
    bobCookies = (login.headers['set-cookie'] as unknown as string[])
      .map((cookie) => cookie.split(';')[0].trim())
      .join('; ');

    agentActorId = (
      await app.get(AgentsService).getAgentBySlug({ slug: 'taico' })
    ).actorId;
  }, 30000);

  afterAll(async () => {
    await app.close();
    await fake.stop();
  });

  describe('deployment gate and provider', () => {
    it('refuses the provider type until the operator turns it on', async () => {
      const refused = await api(aliceCookies, 'post', '/ai-providers')
        .send({ name: 'ChatGPT plan', type: 'chatgpt_subscription' })
        .expect(403);

      expect(refused.body.code).toBe('AI_PROVIDER_TYPE_DISABLED');
      expect(refused.body.detail).toContain('CHATGPT_SUBSCRIPTION_ENABLED');
    });

    it('creates one provider with no secret, next to API-key providers', async () => {
      process.env.CHATGPT_SUBSCRIPTION_ENABLED = 'true';

      const created = await api(aliceCookies, 'post', '/ai-providers')
        .send({ name: 'ChatGPT plan', type: 'chatgpt_subscription' })
        .expect(201);
      providerId = created.body.id;

      expect(created.body).toMatchObject({
        type: 'chatgpt_subscription',
        secretId: null,
        isConfigured: true,
      });

      const duplicate = await api(aliceCookies, 'post', '/ai-providers')
        .send({ name: 'Another', type: 'chatgpt_subscription' })
        .expect(409);
      expect(duplicate.body.code).toBe('AI_PROVIDER_ALREADY_EXISTS');

      const [row] = await dataSource.query(
        `SELECT host_id FROM ai_providers WHERE id = $1`,
        [providerId],
      );
      expect(row.host_id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    });

    it('offers no personal connection on an API-key provider', async () => {
      const openai = await api(aliceCookies, 'post', '/ai-providers')
        .send({ name: 'OpenAI API', type: 'openai' })
        .expect(201);

      const response = await api(
        aliceCookies,
        'get',
        `/ai-providers/${openai.body.id}/connection`,
      ).expect(400);
      expect(response.body.code).toBe('AI_PROVIDER_CONNECTION_NOT_SUPPORTED');
    });

    it('reports nobody as connected to start with', async () => {
      const response = await api(aliceCookies, 'get', connectionPath()).expect(
        200,
      );

      expect(response.body).toMatchObject({
        status: 'disconnected',
        canUsePlan: false,
        accountEmail: null,
        automatedTurnsAllowed: false,
        isAuthorizationPending: false,
        manageUsageUrl: 'https://chatgpt.com/settings/usage',
      });
    });
  });

  describe('sign-in', () => {
    it('sends the browser to OpenAI with PKCE, state, nonce and the 127.0.0.1 redirect', async () => {
      const url = new URL(await startSignIn(aliceCookies));
      const params = url.searchParams;

      expect(`${url.origin}${url.pathname}`).toBe(fake.endpoints.authorizeUrl);
      expect(Object.fromEntries(params)).toMatchObject({
        response_type: 'code',
        client_id: 'dynamic_agent_client',
        agent_name_hint: 'Taico',
        scope:
          'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
        resource: fake.endpoints.apiBaseUrl,
        code_challenge_method: 'S256',
      });
      expect(params.get('redirect_uri')).toBe(
        'http://127.0.0.1:1456/auth/callback',
      );
      expect(params.get('state')!.length).toBeGreaterThanOrEqual(43);
      expect(params.get('nonce')!.length).toBeGreaterThanOrEqual(43);
      expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(params.get('ext_agent_host_id')).toMatch(/^urn:uuid:/);
      // Nothing that identifies the Taico user goes to OpenAI.
      expect(url.toString()).not.toContain(aliceActorId);

      const pending = await api(aliceCookies, 'get', connectionPath()).expect(
        200,
      );
      expect(pending.body.isAuthorizationPending).toBe(true);
    });

    it('connects nothing after approval until the address is pasted', async () => {
      fake.approve(await startSignIn(aliceCookies), ALICE);

      expect((await connectionRow(aliceActorId))?.status).toBeUndefined();

      const pending = await api(aliceCookies, 'get', connectionPath()).expect(
        200,
      );
      expect(pending.body.isAuthorizationPending).toBe(true);
    });

    it('refuses a pasted address that is not the redirect the sign-in asked for', async () => {
      const callbackUrl = fake.approve(await startSignIn(aliceCookies), ALICE);
      const tokenRequestsBefore = fake.tokenRequests.length;

      const elsewhere = new URL(callbackUrl);
      elsewhere.host = 'attacker.example';
      const response = await api(
        aliceCookies,
        'post',
        `${connectionPath()}/callback`,
      )
        .send({ callbackUrl: elsewhere.toString() })
        .expect(400);

      expect(response.body.code).toBe('AI_PROVIDER_AUTHORIZATION_FAILED');
      expect(response.body.detail).toContain(
        'http://127.0.0.1:1456/auth/callback',
      );
      // Never echoes the authorization code back.
      expect(JSON.stringify(response.body)).not.toContain(
        new URL(callbackUrl).searchParams.get('code')!,
      );
      expect(fake.tokenRequests).toHaveLength(tokenRequestsBefore);
      expect((await connectionRow(aliceActorId))?.status).toBeUndefined();
    });

    it('lets only the Taico user who started a sign-in finish it', async () => {
      const authorizationUrl = await startSignIn(aliceCookies);
      const callbackUrl = fake.approve(authorizationUrl, ALICE);
      const tokenRequestsBefore = fake.tokenRequests.length;

      const stolen = await api(
        bobCookies,
        'post',
        `${connectionPath()}/callback`,
      )
        .send({ callbackUrl })
        .expect(400);
      expect(stolen.body.code).toBe('AI_PROVIDER_AUTHORIZATION_FAILED');
      expect(fake.tokenRequests).toHaveLength(tokenRequestsBefore);
      expect(await connectionRow(bobActorId)).toBeUndefined();

      const wrongState = new URL(callbackUrl);
      wrongState.searchParams.set('state', 'forged');
      await api(aliceCookies, 'post', `${connectionPath()}/callback`)
        .send({ callbackUrl: wrongState.toString() })
        .expect(400);

      // Alice's own attempt survived both and still works.
      const connected = await api(
        aliceCookies,
        'post',
        `${connectionPath()}/callback`,
      )
        .send({ callbackUrl })
        .expect(201);
      expect(connected.body).toMatchObject({
        status: 'connected',
        canUsePlan: true,
        accountEmail: ALICE.email,
        isAuthorizationPending: false,
      });

      // The code exchange proves possession of the PKCE verifier and repeats the redirect URI.
      const sent = new URL(authorizationUrl).searchParams;
      const exchange = fake.tokenRequests[fake.tokenRequests.length - 1];
      expect(exchange).toMatchObject({
        grant_type: 'authorization_code',
        redirect_uri: sent.get('redirect_uri'),
        resource: fake.endpoints.apiBaseUrl,
      });
      expect(exchange.client_id).toMatch(/^oaiapp_/);
      expect(
        createHash('sha256').update(exchange.code_verifier).digest('base64url'),
      ).toBe(sent.get('code_challenge'));

      // A callback works once.
      await api(aliceCookies, 'post', `${connectionPath()}/callback`)
        .send({ callbackUrl })
        .expect(400);
    });

    it('stores the tokens encrypted and never returns them', async () => {
      const row = await connectionRow(aliceActorId);
      const accessToken = fake.accessTokenFor(ALICE.subject)!;

      expect(row).toMatchObject({
        status: 'connected',
        external_issuer: fake.issuer,
        external_subject: ALICE.subject,
        external_email: ALICE.email,
      });
      expect(row!.external_client_id).toMatch(/^oaiapp_/);
      expect(row!.credentials).toBeTruthy();
      expect(row!.credentials).not.toContain(accessToken);
      expect(row!.credentials).not.toMatch(/rt-\d+|at-\d+|eyJ/);

      const [attempts] = await dataSource.query(
        `SELECT count(*)::int AS count FROM ai_provider_authorization_attempts`,
      );
      expect(attempts.count).toBe(0);

      const visible = JSON.stringify([
        (await api(aliceCookies, 'get', connectionPath()).expect(200)).body,
        (
          await api(aliceCookies, 'get', `/ai-providers/${providerId}`).expect(
            200,
          )
        ).body,
        (await api(aliceCookies, 'get', '/ai-providers').expect(200)).body,
      ]);
      expect(visible).not.toContain(accessToken);
      expect(visible).not.toMatch(/rt-\d+|oaiapp_|credentials/);
    });

    it('connects nothing when the person refuses at OpenAI', async () => {
      const callbackUrl = fake.approve(await startSignIn(bobCookies), {
        ...BOB,
        deny: true,
      });

      const response = await api(
        bobCookies,
        'post',
        `${connectionPath()}/callback`,
      )
        .send({ callbackUrl })
        .expect(400);

      expect(response.body.detail).toContain('did not approve');
      expect(await connectionRow(bobActorId)).toBeUndefined();
    });

    it('requires the first sign-in to bring a newly issued client id', async () => {
      const callbackUrl = new URL(
        fake.approve(await startSignIn(bobCookies), BOB),
      );
      callbackUrl.searchParams.delete('client_id');

      await api(bobCookies, 'post', `${connectionPath()}/callback`)
        .send({ callbackUrl: callbackUrl.toString() })
        .expect(400);
      expect(await connectionRow(bobActorId)).toBeUndefined();
    });

    it.each([
      ['a different nonce', { nonce: 'someone-elses-nonce' }],
      ['another audience', { audience: 'oaiapp_other' }],
      ['another issuer', { issuer: 'https://evil.example' }],
    ])(
      'rejects an ID token with %s and revokes what it was given',
      async (_label, overrides) => {
        const revocationsBefore = fake.revocations.length;
        fake.nextIdTokenOverrides = overrides;

        const response = await connect(bobCookies, BOB);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('AI_PROVIDER_AUTHORIZATION_FAILED');
        expect(await connectionRow(bobActorId)).toBeUndefined();
        expect(fake.revocations).toHaveLength(revocationsBefore + 1);
      },
    );

    it('records the account but makes no plan requests when plan use was not granted', async () => {
      const response = await connect(bobCookies, {
        ...BOB,
        scope: 'openid profile email',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'plan_access_not_granted',
        canUsePlan: false,
        accountEmail: BOB.email,
      });

      const listing = await api(
        bobCookies,
        'get',
        `/ai-providers/${providerId}/models`,
      ).expect(409);
      expect(listing.body.code).toBe('AI_PROVIDER_CONNECTION_REQUIRED');

      await api(bobCookies, 'delete', connectionPath()).expect(200);
      expect((await connectionRow(bobActorId))?.status).toBe('disconnected');
    });
  });

  describe('models and job scope', () => {
    it('lists the models of the caller’s own account, visible ones only, in OpenAI’s order', async () => {
      const response = await api(
        aliceCookies,
        'get',
        `/ai-providers/${providerId}/models`,
      ).expect(200);

      expect(response.body).toEqual([
        {
          id: 'gpt-plan-large',
          displayName: 'GPT Plan Large',
          kind: 'language',
        },
        {
          id: 'gpt-plan-small',
          displayName: 'GPT Plan Small',
          kind: 'language',
        },
      ]);
      expect(fake.modelsRequests[fake.modelsRequests.length - 1]).toBe(
        `Bearer ${fake.accessTokenFor(ALICE.subject)}`,
      );
    });

    it('does not list models for someone else with Alice’s connection', async () => {
      const before = fake.modelsRequests.length;

      const response = await api(
        bobCookies,
        'get',
        `/ai-providers/${providerId}/models`,
      ).expect(409);

      expect(response.body.code).toBe('AI_PROVIDER_CONNECTION_REQUIRED');
      expect(fake.modelsRequests).toHaveLength(before);
    });

    it('can be selected for the conversation, but not for embeddings', async () => {
      await api(aliceCookies, 'put', '/ai-model-selections/conversation')
        .send({ aiProviderId: providerId, modelId: 'gpt-plan-large' })
        .expect(200);

      const refused = await api(
        aliceCookies,
        'put',
        '/ai-model-selections/embeddings',
      )
        .send({ aiProviderId: providerId, modelId: 'gpt-plan-large' })
        .expect(400);
      expect(refused.body.code).toBe('AI_PROVIDER_JOB_NOT_ALLOWED');
    });

    it('is not inherited by the jobs that normally follow the conversation model', async () => {
      const list: Array<Record<string, unknown>> = (
        await api(aliceCookies, 'get', '/ai-model-selections').expect(200)
      ).body;
      const byJob = Object.fromEntries(
        list.map((selection) => [selection.job, selection]),
      );

      expect(byJob).toMatchObject({
        conversation: { effectiveModelId: 'gpt-plan-large', isReady: true },
        user_small_tasks: {
          followsConversation: true,
          effectiveModelId: null,
          isReady: false,
        },
        system_small_tasks: {
          followsConversation: true,
          effectiveModelId: null,
          isReady: false,
        },
        middle_manager: {
          followsConversation: true,
          effectiveModelId: null,
          isReady: false,
        },
      });

      const factory = app.get(ChatModelFactory);
      const onBehalfOf = { actorId: aliceActorId, automated: false };
      for (const job of [
        AiModelJob.USER_SMALL_TASKS,
        AiModelJob.SYSTEM_SMALL_TASKS,
        AiModelJob.MIDDLE_MANAGER,
      ]) {
        await expect(factory.resolve({ job })).rejects.toMatchObject({
          code: 'AI_MODEL_NOT_SELECTED',
        });
        // Not even when a caller claims to act for the connected person.
        await expect(
          factory.resolve({ job, onBehalfOf }),
        ).rejects.toMatchObject({
          code: 'AI_MODEL_NOT_SELECTED',
        });
      }
      await expect(
        factory.resolve({ job: AiModelJob.CONVERSATION }),
      ).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
    });

    it('makes no plan request for thread titles or the middle manager', async () => {
      const before = fake.responsesRequests.length;
      const chat = app.get(ChatService);

      await expect(
        chat.generateText('Name this thread', {
          job: AiModelJob.USER_SMALL_TASKS,
          onBehalfOf: { actorId: aliceActorId, automated: false },
        }),
      ).resolves.toBeNull();
      await expect(
        chat.generateText('Name this thread', { job: AiModelJob.SYSTEM_SMALL_TASKS }),
      ).resolves.toBeNull();
      await expect(
        chat.runTask({
          instructions: 'Reconcile',
          prompt: 'A task changed',
          actor: null,
        }),
      ).rejects.toMatchObject({ code: 'AI_MODEL_NOT_SELECTED' });

      expect(fake.responsesRequests).toHaveLength(before);
    });
  });

  describe('a Threads turn on the plan', () => {
    let threadId: string;

    it('streams an answer, runs a Taico tool, and sends the whole conversation each time', async () => {
      threadId = await createThread(aliceCookies);
      const before = fake.responsesRequests.length;
      const deltas: string[] = [];
      const onDelta = (event: ThreadAgentResponseDeltaEvent) => {
        deltas.push(event.payload.delta);
      };
      app
        .get(EventEmitter2)
        .on(ThreadAgentResponseDeltaEvent.INTERNAL, onDelta);

      fake.script.push(
        toolCallResponse({
          name: 'tasks__fetch',
          namespace: 'tasks',
          arguments: { taskId: 'task-1' },
          callId: 'call_fetch_1',
        }),
        textResponse('Task 1 is called Ship it.'),
      );

      await sendMessage(aliceCookies, threadId, 'What is task 1 called?');
      const replies = await waitForAgentReplies(threadId, 1);
      app
        .get(EventEmitter2)
        .off(ThreadAgentResponseDeltaEvent.INTERNAL, onDelta);

      expect(replies).toEqual(['Task 1 is called Ship it.']);
      expect(deltas.join('')).toBe('Task 1 is called Ship it.');
      expect(fetchedTasks).toEqual([{ taskId: 'task-1' }]);

      const requests = fake.responsesRequests.slice(before);
      expect(requests).toHaveLength(2);
      const aliceToken = `Bearer ${fake.accessTokenFor(ALICE.subject)}`;
      for (const { authorization, body } of requests) {
        expect(authorization).toBe(aliceToken);
        expect(body).toMatchObject({
          model: 'gpt-plan-large',
          store: false,
          stream: true,
        });
        expect(body).not.toHaveProperty('previous_response_id');
        expect(body).not.toHaveProperty('conversation');
        expect(body).not.toHaveProperty('temperature');
        expect(body).not.toHaveProperty('max_output_tokens');
        expect(
          (body.input as Array<{ role?: string }>).some(
            (item) => item.role === 'system',
          ),
        ).toBe(false);
        expect(inputText(body)).toContain('What is task 1 called?');
        // Function tools are only accepted inside a namespace.
        expect(
          (body.tools as Array<{ type: string }>).every(
            (t) => t.type === 'namespace',
          ),
        ).toBe(true);
        // Thread tools first in their own small namespace, then one per MCP server.
        const namespaces = body.tools as Array<{ name: string; tools: Array<{ name: string }> }>;
        expect(namespaces.map((ns) => ns.name).slice(0, 2)).toEqual(['taico', 'tasks']);
        expect(namespaces[0].tools.map((t) => t.name)).toEqual(
          expect.arrayContaining(['get_time', 'stay_silent', 'remind']),
        );
        expect(namespaces[0].tools.some((t) => t.name.includes('__'))).toBe(false);
        expect(namespaces[1].tools.map((t) => t.name)).toContain('tasks__fetch');
      }

      expect(requests[1].body.input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function_call',
            call_id: 'call_fetch_1',
            namespace: 'tasks',
          }),
          expect.objectContaining({
            type: 'function_call_output',
            call_id: 'call_fetch_1',
          }),
        ]),
      );

      const log: Array<{ provider_type: string | null; role: string }> =
        await dataSource.query(
          `SELECT provider_type, role FROM thread_agent_messages
          WHERE thread_id = $1 AND source = 'model'`,
          [threadId],
        );
      expect(log.length).toBeGreaterThan(0);
      expect(
        log.every((row) => row.provider_type === 'chatgpt_subscription'),
      ).toBe(true);
    });

    it('keeps the history in Taico and replays it on the next turn', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(textResponse('You are welcome.'));

      await sendMessage(aliceCookies, threadId, 'Thanks!');
      await waitForAgentReplies(threadId, 2);

      const [{ body }] = fake.responsesRequests.slice(before);
      const sent = inputText(body);
      expect(sent).toContain('What is task 1 called?');
      expect(sent).toContain('Task 1 is called Ship it.');
      expect(sent).toContain('call_fetch_1');
      expect(sent).toContain('Thanks!');
    });

    it('does not answer another person with Alice’s plan, or with another provider', async () => {
      const before = fake.responsesRequests.length;

      await sendMessage(bobCookies, threadId, 'Can I ask something too?');
      const replies = await waitForAgentReplies(threadId, 3);

      expect(replies[2]).toContain('has not connected a ChatGPT account');
      expect(replies[2]).toContain('No other provider was used.');
      expect(fake.responsesRequests).toHaveLength(before);
    });

    it('answers each person on their own plan once they connect', async () => {
      expect((await connect(bobCookies, BOB)).status).toBe(201);
      const before = fake.responsesRequests.length;
      fake.script.push(textResponse('Hello Bob.'));

      await sendMessage(bobCookies, threadId, 'And now?');
      await waitForAgentReplies(threadId, 4);

      const [fromBob] = fake.responsesRequests.slice(before);
      expect(fromBob.authorization).toBe(
        `Bearer ${fake.accessTokenFor(BOB.subject)}`,
      );
      expect(fromBob.authorization).not.toBe(
        `Bearer ${fake.accessTokenFor(ALICE.subject)}`,
      );
      // Bob's turn still carries the thread's history, which Taico holds.
      expect(inputText(fromBob.body)).toContain('What is task 1 called?');
    });

    it('honours a thread’s own provider and model', async () => {
      const pinned = await createThread(aliceCookies);
      await dataSource.query(
        `UPDATE threads SET ai_provider_id = $1, model_id = $2 WHERE id = $3`,
        [providerId, 'gpt-plan-small', pinned],
      );
      const before = fake.responsesRequests.length;

      await sendMessage(aliceCookies, pinned, 'Which model is this?');
      await waitForAgentReplies(pinned, 1);

      expect(fake.responsesRequests.slice(before)[0].body.model).toBe(
        'gpt-plan-small',
      );
    });
  });

  describe('automated turns', () => {
    const turnFor = (actorId: string, automated: boolean) =>
      app
        .get(ChatgptConnectionsService)
        .authorizeTurn(providerId, { actorId, automated });

    it('does not run a turn nobody typed on a person’s plan without their consent', async () => {
      await expect(turnFor(aliceActorId, false)).resolves.toEqual({
        connectionId: expect.any(String),
      });
      await expect(turnFor(aliceActorId, true)).rejects.toMatchObject({
        code: 'AI_PROVIDER_CONNECTION_CONSENT_REQUIRED',
      });
    });

    it('runs it once that person allows it, and for nobody else', async () => {
      const updated = await api(aliceCookies, 'patch', connectionPath())
        .send({ automatedTurnsAllowed: true })
        .expect(200);
      expect(updated.body.automatedTurnsAllowed).toBe(true);

      await expect(turnFor(aliceActorId, true)).resolves.toBeDefined();
      await expect(turnFor(bobActorId, true)).rejects.toMatchObject({
        code: 'AI_PROVIDER_CONNECTION_CONSENT_REQUIRED',
      });
    });

    it('never runs for an agent, which has no plan of its own', async () => {
      await expect(turnFor(agentActorId, false)).rejects.toMatchObject({
        code: 'AI_PROVIDER_CONNECTION_REQUIRED',
      });
    });
  });

  describe('the middle manager on the plan', () => {
    const runFor = (actorId: string | null) =>
      app.get(ChatService).runTask({
        instructions: 'Reconcile the thread state',
        prompt: 'Task 1 changed status to DONE.',
        actor: null,
        onBehalfOf: actorId
          ? { actorId, automated: true, description: 'the person who created this thread' }
          : undefined,
      });

    beforeAll(async () => {
      await api(aliceCookies, 'put', '/ai-model-selections/middle_manager')
        .send({ aiProviderId: providerId, modelId: 'gpt-plan-small' })
        .expect(200);
    });

    afterAll(async () => {
      await api(aliceCookies, 'delete', '/ai-model-selections/middle_manager').expect(204);
    });

    it('can be selected for the middle manager directly', async () => {
      const list: Array<Record<string, unknown>> = (
        await api(aliceCookies, 'get', '/ai-model-selections').expect(200)
      ).body;
      expect(list.find((s) => s.job === 'middle_manager')).toMatchObject({
        aiProviderId: providerId,
        modelId: 'gpt-plan-small',
        followsConversation: false,
        effectiveModelId: 'gpt-plan-small',
        isReady: true,
      });
      // Small tasks still do not inherit the conversation's plan.
      for (const job of ['user_small_tasks', 'system_small_tasks']) {
        expect(list.find((s) => s.job === job)).toMatchObject({ effectiveModelId: null });
      }
    });

    it('runs streamed, on the plan of the person it is for, who allowed unattended runs', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(textResponse('Nothing relevant.'));

      await runFor(aliceActorId);

      const requests = fake.responsesRequests.slice(before);
      expect(requests).toHaveLength(1);
      expect(requests[0].authorization).toBe(
        `Bearer ${fake.accessTokenFor(ALICE.subject)}`,
      );
      expect(requests[0].body).toMatchObject({
        model: 'gpt-plan-small',
        store: false,
        stream: true,
      });
      expect(inputText(requests[0].body)).toContain('Task 1 changed status to DONE.');
    });

    it('fails the run when the stream fails, without trying anything else', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(failedResponse('server_error', 'Something went wrong'));

      await expect(runFor(aliceActorId)).rejects.toBeDefined();
      expect(fake.responsesRequests).toHaveLength(before + 1);
    });

    it('makes no request without consent, for an agent, or without saying whose plan', async () => {
      const before = fake.responsesRequests.length;

      await expect(runFor(bobActorId)).rejects.toMatchObject({
        code: expect.stringMatching(/^AI_PROVIDER_CONNECTION_(CONSENT_)?REQUIRED$/),
      });
      await expect(runFor(agentActorId)).rejects.toMatchObject({
        code: 'AI_PROVIDER_CONNECTION_REQUIRED',
      });
      await expect(runFor(null)).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });

      expect(fake.responsesRequests).toHaveLength(before);
    });
  });

  describe('user small tasks (thread titles a person started) on the plan', () => {
    // By now Alice is connected and allowed unattended runs; Bob is connected
    // but has not; the agent has no plan.
    const titles = () => app.get(ThreadTitleService);
    const task = { name: 'Ship it', description: 'Release 1.0' } as never;
    const human = (id: string) => ({ id, type: ActorType.HUMAN });
    const agent = (id: string) => ({ id, type: ActorType.AGENT });

    beforeAll(async () => {
      await api(aliceCookies, 'put', '/ai-model-selections/user_small_tasks')
        .send({ aiProviderId: providerId, modelId: 'gpt-plan-small' })
        .expect(200);
    });

    afterAll(async () => {
      await api(aliceCookies, 'delete', '/ai-model-selections/user_small_tasks').expect(204);
    });

    it('can be selected for user small tasks directly, but never for system small tasks', async () => {
      const list: Array<Record<string, unknown>> = (
        await api(aliceCookies, 'get', '/ai-model-selections').expect(200)
      ).body;
      expect(list.find((s) => s.job === 'user_small_tasks')).toMatchObject({
        aiProviderId: providerId,
        modelId: 'gpt-plan-small',
        followsConversation: false,
        effectiveModelId: 'gpt-plan-small',
        isReady: true,
      });

      const refused = await api(aliceCookies, 'put', '/ai-model-selections/system_small_tasks')
        .send({ aiProviderId: providerId, modelId: 'gpt-plan-small' })
        .expect(400);
      expect(refused.body.code).toBe('AI_PROVIDER_JOB_NOT_ALLOWED');
      expect(refused.body.detail).toContain('Pick a provider with an API key');
      expect(list.find((s) => s.job === 'system_small_tasks')).toMatchObject({
        aiProviderId: null,
        effectiveModelId: null,
        isReady: false,
      });
    });

    it('names a thread from its first message on the author’s plan, streamed', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(textResponse('Bob’s release plan'));

      // Bob has not allowed unattended runs; he typed this, so none is needed.
      await expect(
        titles().generateFromMessage('Plan the release', human(bobActorId)),
      ).resolves.toBe('Bob’s release plan');

      const requests = fake.responsesRequests.slice(before);
      expect(requests).toHaveLength(1);
      expect(requests[0].authorization).toBe(`Bearer ${fake.accessTokenFor(BOB.subject)}`);
      expect(requests[0].body).toMatchObject({
        model: 'gpt-plan-small',
        store: false,
        stream: true,
      });
      expect(inputText(requests[0].body)).toContain('Plan the release');
    });

    it('names a thread a person creates for a task on that person’s plan, through the API', async () => {
      const parent = (
        await api(bobCookies, 'post', '/tasks/tasks')
          .send({ name: 'Ship it', description: 'Release 1.0' })
          .expect(201)
      ).body;
      const before = fake.responsesRequests.length;
      fake.script.push(textResponse('Ship release one'));

      const thread = (
        await api(bobCookies, 'post', '/threads').send({ parentTaskId: parent.id }).expect(201)
      ).body;

      expect(thread.title).toBe('Ship release one');
      const requests = fake.responsesRequests.slice(before);
      expect(requests).toHaveLength(1);
      // Bob created it, so Bob's plan pays; nobody else's, and no consent for unattended runs needed.
      expect(requests[0].authorization).toBe(`Bearer ${fake.accessTokenFor(BOB.subject)}`);
    });

    it('never runs work an agent started on anyone’s plan', async () => {
      const before = fake.responsesRequests.length;

      // No system small tasks model: the title stays default and nobody's plan is touched.
      await expect(titles().generateFromParentTask(task, agent(agentActorId))).resolves.toBeNull();
      await expect(titles().generateFromMessage('Hi', agent(agentActorId))).resolves.toBeNull();

      expect(fake.responsesRequests).toHaveLength(before);
    });

    it('refuses an unattended user small task, even for someone who allowed unattended runs', async () => {
      const before = fake.responsesRequests.length;

      await expect(
        app.get(ChatModelFactory).resolve({
          job: AiModelJob.USER_SMALL_TASKS,
          onBehalfOf: { actorId: aliceActorId, automated: true },
        }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_JOB_NOT_ALLOWED' });

      expect(fake.responsesRequests).toHaveLength(before);
    });

    it('gives no title when the stream fails, and tries nothing else', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(failedResponse('server_error', 'Something went wrong', 'Half a'));

      await expect(
        titles().generateFromMessage('Plan the release', human(aliceActorId)),
      ).resolves.toBeNull();

      expect(fake.responsesRequests).toHaveLength(before + 1);
    });

    it('gives no title at the usage limit, and tries nothing else', async () => {
      const before = fake.responsesRequests.length;
      fake.script.push(
        failedResponse('subscription_sharing_usage_limit_exceeded', 'Usage limit reached'),
      );

      await expect(
        titles().generateFromMessage('Plan the release', human(aliceActorId)),
      ).resolves.toBeNull();

      expect(fake.responsesRequests).toHaveLength(before + 1);
    });

    describe('with an API-key provider for system small tasks', () => {
      let server: Server;
      let apiProviderId: string;
      const completions: Array<{ authorization?: string; body: Record<string, unknown> }> = [];

      beforeAll(async () => {
        server = createServer((req, res) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            completions.push({
              authorization: req.headers.authorization,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                id: 'chatcmpl-1',
                object: 'chat.completion',
                created: 0,
                model: 'small-api-model',
                choices: [
                  {
                    index: 0,
                    message: { role: 'assistant', content: 'Agent subtask plan' },
                    finish_reason: 'stop',
                  },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              }),
            );
          });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address() as AddressInfo;
        apiProviderId = (
          await api(aliceCookies, 'post', '/ai-providers')
            .send({
              name: 'Small API',
              type: 'openai_compatible',
              baseUrl: `http://127.0.0.1:${port}/v1`,
            })
            .expect(201)
        ).body.id;
        await api(aliceCookies, 'patch', `/ai-providers/${apiProviderId}`)
          .send({ apiKey: 'sk-system' })
          .expect(200);
        await api(aliceCookies, 'put', '/ai-model-selections/system_small_tasks')
          .send({ aiProviderId: apiProviderId, modelId: 'small-api-model' })
          .expect(200);
      });

      afterAll(async () => {
        try {
          await api(aliceCookies, 'delete', '/ai-model-selections/system_small_tasks').expect(204);
          await api(aliceCookies, 'delete', `/ai-providers/${apiProviderId}`).expect(204);
        } finally {
          await new Promise((resolve) => server.close(resolve));
        }
      });

      it('names a thread an agent created on the API-key provider, never on a plan', async () => {
        const planBefore = fake.responsesRequests.length;
        const apiBefore = completions.length;

        await expect(
          titles().generateFromParentTask(task, agent(agentActorId)),
        ).resolves.toBe('Agent subtask plan');

        expect(fake.responsesRequests).toHaveLength(planBefore);
        expect(completions.slice(apiBefore)).toEqual([
          expect.objectContaining({
            authorization: 'Bearer sk-system',
            body: expect.objectContaining({ model: 'small-api-model' }),
          }),
        ]);
      });

      it('keeps work a person started on their own plan', async () => {
        const planBefore = fake.responsesRequests.length;
        const apiBefore = completions.length;
        fake.script.push(textResponse('Alice’s title'));

        await expect(
          titles().generateFromMessage('Plan the release', human(aliceActorId)),
        ).resolves.toBe('Alice’s title');

        expect(fake.responsesRequests).toHaveLength(planBefore + 1);
        expect(completions).toHaveLength(apiBefore);
      });

      it('does not fall back to the API-key provider when a person’s plan fails', async () => {
        const apiBefore = completions.length;
        fake.script.push(
          failedResponse('subscription_sharing_usage_limit_exceeded', 'Usage limit reached'),
        );

        await expect(
          titles().generateFromMessage('Plan the release', human(aliceActorId)),
        ).resolves.toBeNull();

        expect(completions).toHaveLength(apiBefore);
      });
    });
  });

  describe('token refresh', () => {
    const tokenOf = (actorId: string) =>
      connectionRow(actorId).then((row) =>
        app.get(ChatgptConnectionsService).getAccessToken(row!.id as string),
      );
    const refreshes = () =>
      fake.tokenRequests.filter((form) => form.grant_type === 'refresh_token');

    it('rotates once when several requests find the token expired at the same time', async () => {
      const oldToken = fake.accessTokenFor(ALICE.subject);
      const oldCredentials = (await connectionRow(aliceActorId))!.credentials;
      await expireAccessToken(aliceActorId);
      const before = refreshes().length;
      fake.refreshDelayMs = 100;

      const tokens = await Promise.all(
        Array.from({ length: 5 }, () => tokenOf(aliceActorId)),
      );
      fake.refreshDelayMs = 0;

      expect(refreshes()).toHaveLength(before + 1);
      expect(new Set(tokens).size).toBe(1);
      expect(tokens[0]).toBe(fake.accessTokenFor(ALICE.subject));
      expect(tokens[0]).not.toBe(oldToken);

      const row = await connectionRow(aliceActorId);
      expect(row!.credentials).not.toBe(oldCredentials);
      expect(new Date(row!.access_token_expires_at).getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(refreshes()[before]).toMatchObject({
        client_id: row!.external_client_id,
        resource: fake.endpoints.apiBaseUrl,
      });
      expect(refreshes()[before]).not.toHaveProperty('scope');
    });

    it('uses the rotated refresh token the next time', async () => {
      const previous = refreshes()[refreshes().length - 1].refresh_token;
      await expireAccessToken(aliceActorId);

      expect(await tokenOf(aliceActorId)).toBe(
        fake.accessTokenFor(ALICE.subject),
      );

      // The fake rejects a refresh token that was already rotated away.
      expect(refreshes()[refreshes().length - 1].refresh_token).not.toBe(
        previous,
      );
    });

    it('keeps the connection when OpenAI is briefly unavailable', async () => {
      await expireAccessToken(aliceActorId);
      fake.nextRefreshError = 'server_error';

      await expect(tokenOf(aliceActorId)).rejects.toMatchObject({
        code: 'AI_PROVIDER_REQUEST_FAILED',
      });

      const row = await connectionRow(aliceActorId);
      expect(row).toMatchObject({ status: 'connected' });
      expect(row!.credentials).toBeTruthy();
      expect(await tokenOf(aliceActorId)).toBe(
        fake.accessTokenFor(ALICE.subject),
      );
    });

    it('clears the tokens and asks for a new sign-in when the grant is gone', async () => {
      const threadId = await createThread(aliceCookies);
      await expireAccessToken(aliceActorId);
      fake.nextRefreshError = 'refresh_token_invalidated';
      const before = fake.responsesRequests.length;

      await sendMessage(aliceCookies, threadId, 'Still there?');
      const [reply] = await waitForAgentReplies(threadId, 1);

      expect(reply).toContain('Sign in again');
      expect(reply).toContain('No other provider was used.');
      expect(fake.responsesRequests).toHaveLength(before);

      const row = await connectionRow(aliceActorId);
      expect(row).toMatchObject({
        status: 'needs_reauthorization',
        credentials: null,
      });
      expect(row!.external_client_id).toMatch(/^oaiapp_/);

      const status = await api(aliceCookies, 'get', connectionPath()).expect(
        200,
      );
      expect(status.body).toMatchObject({
        status: 'needs_reauthorization',
        canUsePlan: false,
      });
    });

    it('signs in again with the issued client, and only as the same account', async () => {
      const issuedClientId = (await connectionRow(aliceActorId))!
        .external_client_id;

      const authorizationUrl = await startSignIn(aliceCookies);
      const params = new URL(authorizationUrl).searchParams;
      expect(params.get('client_id')).toBe(issuedClientId);
      expect(params.get('login_hint')).toBe(ALICE.email);
      expect(params.has('agent_name_hint')).toBe(false);

      const other = await api(
        aliceCookies,
        'post',
        `${connectionPath()}/callback`,
      )
        .send({
          callbackUrl: fake.approve(authorizationUrl, {
            subject: 'user-mallory',
            email: 'mallory@chatgpt.example',
          }),
        })
        .expect(400);
      expect(other.body.detail).toContain('different ChatGPT account');
      expect((await connectionRow(aliceActorId))!.status).toBe(
        'needs_reauthorization',
      );

      const again = await connect(aliceCookies, ALICE);
      expect(again.status).toBe(201);
      expect(again.body).toMatchObject({
        status: 'connected',
        automatedTurnsAllowed: true,
      });
      expect((await connectionRow(aliceActorId))!.external_client_id).toBe(
        issuedClientId,
      );
    });
  });

  describe('plan limits and compaction', () => {
    it('stops at the usage limit, says where to look, and switches to nothing', async () => {
      const threadId = await createThread(aliceCookies);
      const before = fake.responsesRequests.length;
      fake.script.push(
        failedResponse(
          'subscription_sharing_usage_limit_exceeded',
          'Usage limit reached',
          'I was',
        ),
      );

      await sendMessage(aliceCookies, threadId, 'One more question');
      const [reply] = await waitForAgentReplies(threadId, 1);

      expect(reply).toContain('usage limit of your ChatGPT plan');
      expect(reply).toContain('https://chatgpt.com/settings/usage');
      expect(reply).toContain('did not switch to another provider');
      // Not retried, and no half answer is stored as the reply.
      expect(fake.responsesRequests).toHaveLength(before + 1);
      const partial: unknown[] = await dataSource.query(
        `SELECT 1 FROM thread_agent_messages WHERE thread_id = $1 AND source = 'model'`,
        [threadId],
      );
      expect(partial).toHaveLength(0);

      const status = await api(aliceCookies, 'get', connectionPath()).expect(
        200,
      );
      expect(status.body).toMatchObject({
        status: 'connected',
        lastErrorCode: 'subscription_sharing_usage_limit_exceeded',
      });
      expect(status.body.lastErrorAt).toEqual(expect.any(String));

      fake.script.push(textResponse('Back again.'));
      await sendMessage(aliceCookies, threadId, 'And now?');
      await waitForAgentReplies(threadId, 2);

      for (let attempt = 0; attempt < 40; attempt++) {
        if (!(await connectionRow(aliceActorId))!.last_error_code) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect((await connectionRow(aliceActorId))!.last_error_code).toBeNull();
    });

    it('summarizes a long thread with a streamed request on the same person’s plan', async () => {
      const config = getConfig();
      const originalThreshold = config.threadAgentCompactionTokenThreshold;
      config.threadAgentCompactionTokenThreshold = 1;

      try {
        const threadId = await createThread(aliceCookies);
        const before = fake.responsesRequests.length;
        fake.script.push(
          textResponse('The release is on Friday.', 500),
          textResponse('Summary: the release is on Friday.'),
        );

        await sendMessage(aliceCookies, threadId, 'When is the release?');
        await waitForAgentReplies(threadId, 1);

        const [answer, summary] = fake.responsesRequests.slice(before);
        expect(fake.responsesRequests).toHaveLength(before + 2);
        expect(summary.authorization).toBe(answer.authorization);
        expect(summary.authorization).toBe(
          `Bearer ${fake.accessTokenFor(ALICE.subject)}`,
        );
        expect(summary.body).toMatchObject({ store: false, stream: true });
        expect(summary.body.tools ?? []).toHaveLength(0);

        const [stored] = await dataSource.query(
          `SELECT message FROM thread_agent_messages WHERE thread_id = $1 AND kind = 'summary'`,
          [threadId],
        );
        expect(JSON.stringify(stored.message)).toContain(
          'Summary: the release is on Friday.',
        );
      } finally {
        config.threadAgentCompactionTokenThreshold = originalThreshold;
      }
    });

    it('stores no summary when the summary stream fails', async () => {
      const config = getConfig();
      const originalThreshold = config.threadAgentCompactionTokenThreshold;
      config.threadAgentCompactionTokenThreshold = 1;

      try {
        const threadId = await createThread(aliceCookies);
        fake.script.push(
          textResponse('Noted.', 500),
          failedResponse(
            'subscription_sharing_usage_unavailable',
            'Try later',
            'Summary: half',
          ),
        );

        await sendMessage(aliceCookies, threadId, 'Remember this.');
        // The answer was already delivered; the failed summary does not turn it into an error.
        expect(await waitForAgentReplies(threadId, 1)).toEqual(['Noted.']);

        const summaries: unknown[] = await dataSource.query(
          `SELECT 1 FROM thread_agent_messages WHERE thread_id = $1 AND kind = 'summary'`,
          [threadId],
        );
        expect(summaries).toHaveLength(0);
      } finally {
        config.threadAgentCompactionTokenThreshold = originalThreshold;
      }
    });
  });

  describe('disconnecting', () => {
    it('revokes the grant at OpenAI and removes everything stored about the account', async () => {
      const before = fake.revocations.length;
      const clientId = (await connectionRow(aliceActorId))!.external_client_id;
      const tokenBefore = fake.accessTokenFor(ALICE.subject);

      const response = await api(
        aliceCookies,
        'delete',
        connectionPath(),
      ).expect(200);

      expect(response.body).toEqual({ revokedAtProvider: true });
      expect(fake.revocations).toHaveLength(before + 1);
      expect(fake.revocations[before]).toMatchObject({
        token_type_hint: 'refresh_token',
        client_id: clientId,
      });
      expect(fake.revocations[before].token).toMatch(/^rt-/);
      // The fake no longer accepts the access token of the revoked grant.
      expect(tokenBefore).toBeDefined();
      expect(fake.accessTokenFor(ALICE.subject)).toBeUndefined();

      expect(await connectionRow(aliceActorId)).toMatchObject({
        status: 'disconnected',
        credentials: null,
        external_client_id: null,
        external_subject: null,
        external_email: null,
        granted_scopes: null,
        automated_turns_allowed_at: null,
      });
    });

    it('stops answering for that person', async () => {
      const threadId = await createThread(aliceCookies);
      const before = fake.responsesRequests.length;

      await sendMessage(aliceCookies, threadId, 'Hello?');
      const [reply] = await waitForAgentReplies(threadId, 1);

      expect(reply).toContain('has not connected a ChatGPT account');
      expect(fake.responsesRequests).toHaveLength(before);
    });

    it('still removes the local tokens when OpenAI cannot be told', async () => {
      fake.revocationStatus = 503;

      const response = await api(bobCookies, 'delete', connectionPath()).expect(
        200,
      );
      fake.revocationStatus = 200;

      expect(response.body).toEqual({ revokedAtProvider: false });
      expect(await connectionRow(bobActorId)).toMatchObject({
        status: 'disconnected',
        credentials: null,
      });
    }, 15000);

    it('revokes everyone’s grant when the provider is deleted', async () => {
      expect((await connect(aliceCookies, ALICE)).status).toBe(201);
      const before = fake.revocations.length;

      const inUse = await api(
        aliceCookies,
        'delete',
        `/ai-providers/${providerId}`,
      ).expect(409);
      expect(inUse.body.code).toBe('AI_PROVIDER_IN_USE');

      await api(
        aliceCookies,
        'delete',
        '/ai-model-selections/conversation',
      ).expect(204);
      await api(aliceCookies, 'delete', `/ai-providers/${providerId}`).expect(
        204,
      );

      expect(fake.revocations).toHaveLength(before + 1);
      expect(fake.accessTokenFor(ALICE.subject)).toBeUndefined();
      expect(await connectionRow(aliceActorId)).toMatchObject({
        status: 'disconnected',
        credentials: null,
      });
    });
  });
});
