import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { decodeJwt, SignJWT } from 'jose';
import { AddressInfo } from 'net';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuthJourneysService } from '../src/auth-journeys/auth-journeys.service';
import { McpAuthorizationFlowEntity } from '../src/auth-journeys/entities';
import {
  CLIENT_METADATA_FETCH_OPTIONS,
  DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
} from '../src/authorization-server/client-metadata-document.fetcher';
import { RegisteredClientEntity } from '../src/authorization-server/entities/registered-client.entity';
import { getConfig } from '../src/config/env.config';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import {
  ClientMetadataHost,
  ClientSigningKey,
  FakeMcpClient,
  generateClientSigningKey,
} from './helpers/fake-mcp-client';

const TASKS_MCP_PATH = '/api/v1/tasks/tasks/mcp';
const CONTEXT_MCP_PATH = '/api/v1/context/blocks/mcp';
const REDIRECT_URI = 'http://localhost:6274/oauth/callback';

describe('MCP clients identified by a Client ID Metadata Document (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let baseUrl: string;
  let issuerUrl: string;
  let tasksMcpUrl: string;
  let authCookies: string;
  let metadataHost: ClientMetadataHost;
  let clients: Repository<RegisteredClientEntity>;
  let flows: Repository<McpAuthorizationFlowEntity>;
  let documentCounter = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // The fake client serves its metadata document from 127.0.0.1 over http,
      // which the real fetch policy refuses.
      .overrideProvider(CLIENT_METADATA_FETCH_OPTIONS)
      .useValue({
        ...DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
        allowInsecureLoopback: true,
        // Lets a test rotate a client's keys without waiting a minute
        minKeySetRefetchIntervalMs: 0,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '/.well-known/*path', method: RequestMethod.ALL }],
    });
    await app.listen(0, '127.0.0.1');
    httpServer = app.getHttpServer();
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);

    issuerUrl = getConfig().issuerUrl;
    tasksMcpUrl = `${issuerUrl}${TASKS_MCP_PATH}`;
    clients = app.get(getRepositoryToken(RegisteredClientEntity));
    flows = app.get(getRepositoryToken(McpAuthorizationFlowEntity));

    metadataHost = new ClientMetadataHost();
    await metadataHost.start();
  });

  afterAll(async () => {
    await metadataHost.stop();
    await app.close();
  });

  /** Taico's public URLs, reached at the address the test app listens on */
  const route = (url: string) =>
    url.startsWith(issuerUrl) ? baseUrl + url.slice(issuerUrl.length) : url;

  /** The user: follows the authorization URL to the consent screen and approves */
  async function approve(authorizationUrl: URL): Promise<URL> {
    const flowId = await openConsentScreen(authorizationUrl);
    return submitConsent(authorizationUrl, flowId);
  }

  async function openConsentScreen(authorizationUrl: URL): Promise<string> {
    const response = await fetch(route(authorizationUrl.toString()), {
      redirect: 'manual',
    });
    if (response.status !== 302) {
      throw new Error(
        `authorize -> ${response.status} ${await response.text()}`,
      );
    }
    const consentScreen = new URL(response.headers.get('location')!);
    const flowId = consentScreen.searchParams.get('flow');
    if (!flowId) {
      throw new Error(`not sent to the consent screen: ${consentScreen}`);
    }
    return flowId;
  }

  async function submitConsent(
    authorizationUrl: URL,
    flowId: string,
  ): Promise<URL> {
    const response = await fetch(
      route(`${authorizationUrl.origin}${authorizationUrl.pathname}`),
      {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json', cookie: authCookies },
        body: JSON.stringify({ flow_id: flowId, approved: true }),
      },
    );
    if (response.status !== 302) {
      throw new Error(`consent -> ${response.status} ${await response.text()}`);
    }
    return new URL(response.headers.get('location')!);
  }

  function publishDocument(
    document: Record<string, unknown> = {},
    headers?: Record<string, string>,
  ): string {
    return metadataHost.publish(
      `/clients/${++documentCounter}/metadata.json`,
      {
        client_name: 'Fake CIMD client',
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        ...document,
      },
      headers,
    );
  }

  function newClient(
    clientMetadataUrl?: string,
    redirectUri = REDIRECT_URI,
    signingKey?: ClientSigningKey,
  ): FakeMcpClient {
    return new FakeMcpClient({
      redirectUri,
      clientMetadataUrl,
      signingKey,
      approve,
      route,
    });
  }

  /**
   * A client set up the way ChatGPT is: its document asks for private_key_jwt
   * and points at a key set it hosts next to it.
   */
  async function newSigningClient(document: Record<string, unknown> = {}) {
    const key = await generateClientSigningKey();
    const keysPath = `/keys/${++documentCounter}/jwks.json`;
    const jwksUri = metadataHost.respond(keysPath, {
      body: JSON.stringify({ keys: [key.publicJwk] }),
    });
    const clientId = publishDocument({
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'RS256',
      jwks_uri: jwksUri,
      ...document,
    });
    const client = newClient(clientId, REDIRECT_URI, key);
    return { client, clientId, key, keysPath, jwksUri };
  }

  /** Sends an authorization request directly, for requests the server must refuse */
  function authorizeRequest(
    clientId: string,
    overrides: Record<string, string> = {},
  ) {
    return request(httpServer)
      .get('/api/v1/auth/authorize/mcp/tasks/0.0.0')
      .query({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        state: 'test-state',
        code_challenge: 'a'.repeat(43),
        code_challenge_method: 'S256',
        resource: tasksMcpUrl,
        ...overrides,
      });
  }

  describe('discovery', () => {
    it('advertises Client ID Metadata Document support next to dynamic registration', async () => {
      const client = newClient();
      const metadata = await client.discover(tasksMcpUrl);

      expect(metadata.client_id_metadata_document_supported).toBe(true);
      expect(metadata.token_endpoint_auth_methods_supported).toEqual([
        'none',
        'private_key_jwt',
      ]);
      expect(metadata.registration_endpoint).toBeDefined();
      expect(client.metadataUrl).toBe(
        `${issuerUrl}/.well-known/oauth-authorization-server/mcp/tasks/0.0.0`,
      );
    });
  });

  describe('a client with a metadata document', () => {
    it('connects without registering, calls the MCP server and refreshes', async () => {
      const clientId = publishDocument({ client_name: 'Metadata Doc Client' });
      const registeredBefore = await clients.count();
      const client = newClient(clientId);

      const tokens = await client.connect(tasksMcpUrl, 'mcp:use');

      expect(client.registrationMethod).toBe('metadata_document');
      expect(client.clientId).toBe(clientId);
      // The only new client is the cached metadata document
      expect(await clients.count()).toBe(registeredBefore + 1);
      const stored = await clients.findOneByOrFail({ clientId });
      expect(stored.clientName).toBe('Metadata Doc Client');
      expect(stored.registrationMethod).toBe('metadata_document');
      expect(stored.clientSecret).toBeNull();

      const claims = decodeJwt(tokens.access_token);
      expect(claims.aud).toBe(tasksMcpUrl);
      expect(claims.client_id).toBe(clientId);
      expect((await client.callMcp()).status).toBe(200);

      const refreshed = await client.refresh();
      expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
      expect(decodeJwt(refreshed.access_token).client_id).toBe(clientId);
      expect((await client.callMcp()).status).toBe(200);
    });

    it('shows on the consent screen who the client says it is and how it is identified', async () => {
      const clientId = publishDocument({
        client_name: 'Consent Screen Client',
      });
      const client = newClient(clientId);
      await client.discover(tasksMcpUrl);
      await client.obtainClientId();
      const flowId = await openConsentScreen(
        client.startAuthorization().authorizationUrl,
      );

      const consent = await request(httpServer)
        .get(`/api/v1/auth/consent/${flowId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(consent.body.client).toEqual({
        clientId,
        clientName: 'Consent Screen Client',
        registrationMethod: 'metadata_document',
      });
      expect(consent.body.redirectUri).toBe(REDIRECT_URI);
    });

    it('keeps two users of the same client_id apart', async () => {
      const clientId = publishDocument();
      const [alice, bob] = [newClient(clientId), newClient(clientId)];
      for (const client of [alice, bob]) {
        await client.discover(tasksMcpUrl);
        await client.obtainClientId();
      }

      // Both are in the middle of authorizing at the same time
      const alicePending = alice.startAuthorization('mcp:use');
      const bobPending = bob.startAuthorization('mcp:use');
      const aliceFlow = await openConsentScreen(alicePending.authorizationUrl);
      const bobFlow = await openConsentScreen(bobPending.authorizationUrl);
      expect(aliceFlow).not.toBe(bobFlow);

      const bobCallback = await submitConsent(
        bobPending.authorizationUrl,
        bobFlow,
      );
      const aliceCallback = await submitConsent(
        alicePending.authorizationUrl,
        aliceFlow,
      );
      expect(aliceCallback.searchParams.get('state')).toBe(alicePending.state);
      expect(bobCallback.searchParams.get('state')).toBe(bobPending.state);

      // A code only works with the PKCE verifier of the request it belongs to
      await expect(
        alice.finishAuthorization(
          { ...alicePending, state: bobPending.state },
          bobCallback,
        ),
      ).rejects.toThrow(/token request failed/);

      await alice.finishAuthorization(alicePending, aliceCallback);
      expect((await alice.callMcp()).status).toBe(200);
    });

    it('fetches the document once and reuses it while it is fresh', async () => {
      const clientId = publishDocument({}, { 'cache-control': 'max-age=600' });
      const client = newClient(clientId);

      await client.connect(tasksMcpUrl);
      await client.authorize();

      expect(metadataHost.requestCount(clientId)).toBe(1);
      const stored = await clients.findOneByOrFail({ clientId });
      const lifetimeMs = stored.metadataExpiresAt!.getTime() - Date.now();
      expect(lifetimeMs).toBeGreaterThan(9 * 60 * 1000);
      expect(lifetimeMs).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('fetches the document again once the cached copy has expired', async () => {
      const clientId = publishDocument({ client_name: 'Before' });
      const client = newClient(clientId);
      await client.connect(tasksMcpUrl);

      metadataHost.publish(new URL(clientId).pathname, {
        client_name: 'After',
        redirect_uris: [REDIRECT_URI],
      });
      await clients.update({ clientId }, { metadataExpiresAt: new Date(0) });
      await client.authorize();

      expect(metadataHost.requestCount(clientId)).toBe(2);
      expect((await clients.findOneByOrFail({ clientId })).clientName).toBe(
        'After',
      );
      expect(await clients.countBy({ clientId })).toBe(1);
    });

    it('can use the same client_id on another MCP server', async () => {
      const clientId = publishDocument();
      const contextMcpUrl = `${issuerUrl}${CONTEXT_MCP_PATH}`;

      const tasksClient = newClient(clientId);
      await tasksClient.connect(tasksMcpUrl);
      const contextClient = newClient(clientId);
      const contextTokens = await contextClient.connect(contextMcpUrl);

      expect(decodeJwt(contextTokens.access_token).aud).toBe(contextMcpUrl);
      expect((await contextClient.callMcp()).status).toBe(200);
      // and the token is still bound to the server it was issued for
      expect(
        (await tasksClient.callMcp(contextTokens.access_token)).status,
      ).toBe(401);
    });

    it('accepts any port on a loopback redirect URI', async () => {
      // Native apps listen on a port chosen at run time (RFC 8252 section 7.3)
      const clientId = publishDocument({
        redirect_uris: ['http://127.0.0.1/callback'],
      });
      const client = newClient(clientId, 'http://127.0.0.1:53124/callback');

      await client.connect(tasksMcpUrl);

      expect((await client.callMcp()).status).toBe(200);
    });
  });

  describe('a client that authenticates with a private key (private_key_jwt)', () => {
    it('connects, calls the MCP server and refreshes, signing each token request', async () => {
      const { client, clientId } = await newSigningClient();

      const tokens = await client.connect(tasksMcpUrl);

      const stored = await clients.findOneByOrFail({ clientId });
      expect(stored.tokenEndpointAuthMethod).toBe('private_key_jwt');
      expect(decodeJwt(tokens.access_token).client_id).toBe(clientId);
      expect((await client.callMcp()).status).toBe(200);

      await client.refresh();
      expect((await client.callMcp()).status).toBe(200);
    });

    it('accepts the token endpoint as the audience of the assertion', async () => {
      // Clients written before the audience was narrowed to the issuer send this
      const { client } = await newSigningClient();
      await client.discover(tasksMcpUrl);
      await client.obtainClientId();
      const pending = client.startAuthorization();
      const callback = await approve(pending.authorizationUrl);

      await client.finishAuthorization(
        pending,
        callback,
        await client.signAssertion({ aud: client.metadata!.token_endpoint }),
      );

      expect((await client.callMcp()).status).toBe(200);
    });

    it('accepts keys published inside the metadata document', async () => {
      const key = await generateClientSigningKey();
      const clientId = publishDocument({
        token_endpoint_auth_method: 'private_key_jwt',
        jwks: { keys: [key.publicJwk] },
      });
      const client = newClient(clientId, REDIRECT_URI, key);

      await client.connect(tasksMcpUrl);

      expect((await client.callMcp()).status).toBe(200);
    });

    it('identifies the client by its assertion when client_id is left out', async () => {
      const { client } = await newSigningClient();
      await client.connect(tasksMcpUrl);

      const response = await fetch(route(client.metadata!.token_endpoint), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: client.tokens!.refresh_token,
          client_assertion_type:
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: await client.signAssertion(),
        }).toString(),
      });

      expect(response.status).toBe(201);
    });

    it('keeps working after the client rotates its keys', async () => {
      const { client, key, keysPath } = await newSigningClient();
      await client.connect(tasksMcpUrl);

      const newKey = await generateClientSigningKey();
      metadataHost.respond(keysPath, {
        body: JSON.stringify({ keys: [newKey.publicJwk] }),
      });

      await client.refresh(await client.signAssertion({}, newKey));
      expect((await client.callMcp()).status).toBe(200);
      // and the key that was rotated out no longer works
      await expect(
        client.refresh(await client.signAssertion({}, key)),
      ).rejects.toThrow(/not signed with one of the client's keys/);
    });

    describe('token requests that are refused', () => {
      async function authorizedClient() {
        const setup = await newSigningClient();
        await setup.client.discover(tasksMcpUrl);
        await setup.client.obtainClientId();
        const pending = setup.client.startAuthorization();
        const callback = await approve(pending.authorizationUrl);
        return { ...setup, pending, callback };
      }

      it('refuses an authorization code presented without an assertion', async () => {
        // What someone who intercepted the code and the PKCE verifier could send
        const { client, pending, callback } = await authorizedClient();

        await expect(
          client.finishAuthorization(pending, callback, null),
        ).rejects.toThrow(/401.*must authenticate with a client_assertion/);

        // The refusal did not burn the code: the real client can still redeem it
        await client.finishAuthorization(pending, callback);
        expect((await client.callMcp()).status).toBe(200);
      });

      it('refuses a stolen refresh token presented without the key', async () => {
        const { client } = await newSigningClient();
        await client.connect(tasksMcpUrl);
        const stolen = client.tokens!.refresh_token;

        await expect(client.refresh(null)).rejects.toThrow(
          /401.*INVALID_CLIENT_ASSERTION/,
        );

        // and it was not rotated away by the failed attempt
        expect(client.tokens!.refresh_token).toBe(stolen);
        await client.refresh();
      });

      it('refuses an assertion signed with another key', async () => {
        const { client, pending, callback } = await authorizedClient();
        const otherKey = await generateClientSigningKey();

        await expect(
          client.finishAuthorization(
            pending,
            callback,
            await client.signAssertion({}, otherKey),
          ),
        ).rejects.toThrow(/not signed with one of the client's keys/);
        // also when it claims the key id of the real key
        await expect(
          client.finishAuthorization(
            pending,
            callback,
            await client.signAssertion(
              {},
              { ...otherKey, kid: client['options'].signingKey!.kid },
            ),
          ),
        ).rejects.toThrow(/signature is invalid/);
      });

      it.each([
        [
          'issued by someone else',
          { iss: 'https://other.example/client.json' },
          /"iss" claim/,
        ],
        [
          'about someone else',
          { sub: 'https://other.example/client.json' },
          /"sub" claim/,
        ],
        [
          'addressed to another server',
          { aud: 'https://other.example' },
          /"aud" claim/,
        ],
        [
          'that has expired',
          { exp: Math.floor(Date.now() / 1000) - 300 },
          /has expired/,
        ],
        ['without an expiry', { exp: undefined }, /"exp" claim/],
      ])('refuses an assertion %s', async (_name, claims, reason) => {
        const { client, pending, callback } = await authorizedClient();

        await expect(
          client.finishAuthorization(
            pending,
            callback,
            await client.signAssertion(claims),
          ),
        ).rejects.toThrow(reason);
      });

      it('refuses an assertion addressed to another MCP server of this Taico', async () => {
        const { client, pending, callback } = await authorizedClient();

        await expect(
          client.finishAuthorization(
            pending,
            callback,
            await client.signAssertion({
              aud: `${issuerUrl}/mcp/context/0.0.0`,
            }),
          ),
        ).rejects.toThrow(/"aud" claim/);
      });

      it('refuses an unsigned assertion and one with the wrong type', async () => {
        const { client, pending, callback } = await authorizedClient();
        const unsigned = [
          Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
          Buffer.from(
            JSON.stringify({
              iss: client.clientId,
              sub: client.clientId,
              aud: client.metadata!.issuer,
              exp: Math.floor(Date.now() / 1000) + 60,
            }),
          ).toString('base64url'),
          '',
        ].join('.');

        await expect(
          client.finishAuthorization(pending, callback, unsigned),
        ).rejects.toThrow(/401/);

        const response = await fetch(route(client.metadata!.token_endpoint), {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: client.clientId!,
            code: callback.searchParams.get('code')!,
            redirect_uri: REDIRECT_URI,
            code_verifier: pending.codeVerifier,
            client_assertion_type: 'urn:example:something-else',
            client_assertion: await client.signAssertion(),
          }).toString(),
        });
        expect(response.status).toBe(401);
        expect((await response.json()).detail).toMatch(/client_assertion_type/);
      });

      it('refuses an assertion signed with the public key used as a shared secret', async () => {
        // The classic algorithm confusion attack: everyone knows the public
        // key, so it must never be usable as an HMAC secret.
        const { client, key, pending, callback } = await authorizedClient();
        const now = Math.floor(Date.now() / 1000);
        const forged = await new SignJWT({
          iss: client.clientId,
          sub: client.clientId,
          aud: client.metadata!.issuer,
          iat: now,
          exp: now + 60,
        })
          .setProtectedHeader({ alg: 'HS256', kid: key.kid })
          .sign(Buffer.from(JSON.stringify(key.publicJwk)));

        await expect(
          client.finishAuthorization(pending, callback, forged),
        ).rejects.toThrow(/401 INVALID_CLIENT_ASSERTION/);
      });

      it('refuses a key set that holds a shared secret', async () => {
        const { client, pending, callback, keysPath } =
          await authorizedClient();
        metadataHost.respond(keysPath, {
          body: JSON.stringify({
            keys: [{ kty: 'oct', kid: 'shared', k: 'c2VjcmV0' }],
          }),
        });

        await expect(
          client.finishAuthorization(pending, callback),
        ).rejects.toThrow(/key set is invalid.*public keys only/);
      });

      it('refuses a client whose key set cannot be fetched', async () => {
        const { client, pending, callback, keysPath } =
          await authorizedClient();
        metadataHost.respond(keysPath, { status: 500, body: '' });

        await expect(
          client.finishAuthorization(pending, callback),
        ).rejects.toThrow(/401.*keys could not be fetched.*HTTP 500/);
      });
    });

    it('does not let a client register dynamically with private_key_jwt', async () => {
      await request(httpServer)
        .post('/api/v1/auth/clients/register/mcp/tasks/0.0.0')
        .send({
          client_name: 'Registers with a key it cannot publish',
          redirect_uris: [REDIRECT_URI],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'private_key_jwt',
        })
        .expect(400);
    });

    it('still lets a public metadata document client connect without an assertion', async () => {
      const client = newClient(publishDocument());

      await client.connect(tasksMcpUrl);

      expect((await client.callMcp()).status).toBe(200);
    });
  });

  describe('metadata documents that are refused', () => {
    // The redirect URI of a request cannot be trusted before the client is
    // verified, so these are answered with an error page, never a redirect.
    async function expectRefused(
      clientId: string,
      detail: RegExp,
      overrides?: Record<string, string>,
    ) {
      const response = await authorizeRequest(clientId, overrides).expect(400);
      expect(response.headers.location).toBeUndefined();
      expect(response.body.code).toBe('INVALID_CLIENT_METADATA');
      expect(response.body.detail).toMatch(detail);
    }

    it('refuses a document whose client_id is not the URL it was fetched from', async () => {
      await expectRefused(
        publishDocument({
          client_id: 'https://someone-else.example/client.json',
        }),
        /does not match the URL/,
      );
    });

    it('refuses a document that asks for a client secret', async () => {
      await expectRefused(
        publishDocument({ token_endpoint_auth_method: 'client_secret_basic' }),
        /token_endpoint_auth_method must be "none" or "private_key_jwt"/,
      );
      await expectRefused(
        publishDocument({ client_secret: 'hunter2' }),
        /must not contain a client secret/,
      );
    });

    it('refuses a private_key_jwt document that does not say where its keys are', async () => {
      await expectRefused(
        publishDocument({ token_endpoint_auth_method: 'private_key_jwt' }),
        /needs exactly one of jwks_uri and jwks/,
      );
    });

    it('refuses a document that publishes a private key', async () => {
      const key = await generateClientSigningKey();
      await expectRefused(
        publishDocument({
          token_endpoint_auth_method: 'private_key_jwt',
          jwks: { keys: [{ ...key.publicJwk, d: 'the-private-exponent' }] },
        }),
        /public keys only/,
      );
    });

    it('refuses a signing algorithm that uses a shared secret', async () => {
      await expectRefused(
        publishDocument({
          token_endpoint_auth_method: 'private_key_jwt',
          token_endpoint_auth_signing_alg: 'HS256',
          jwks_uri: `${metadataHost.origin}/keys/any.json`,
        }),
        /token_endpoint_auth_signing_alg "HS256" is not supported/,
      );
    });

    it.each([
      ['no client_name', { client_name: undefined }, /client_name is required/],
      [
        'no redirect_uris',
        { redirect_uris: undefined },
        /redirect_uris must be/,
      ],
      [
        'a plain http redirect URI on a remote host',
        { redirect_uris: ['http://example.com/callback'] },
        /must be https/,
      ],
      [
        'a javascript: redirect URI',
        { redirect_uris: ['javascript:alert(1)'] },
        /must be https/,
      ],
      [
        'grant types without authorization_code',
        { grant_types: ['client_credentials'] },
        /grant_types must include authorization_code/,
      ],
    ])('refuses a document with %s', async (_name, document, detail) => {
      await expectRefused(publishDocument(document), detail);
    });

    it('refuses a URL that does not serve a small JSON document', async () => {
      await expectRefused(
        `${metadataHost.origin}/clients/missing.json`,
        /HTTP 404/,
      );
      await expectRefused(
        metadataHost.respond('/clients/redirect.json', {
          status: 302,
          headers: {
            location: `${metadataHost.origin}/clients/1/metadata.json`,
          },
          body: '',
        }),
        /HTTP 302/,
      );
      await expectRefused(
        metadataHost.respond('/clients/page.json', {
          headers: { 'content-type': 'text/html' },
          body: '<html></html>',
        }),
        /not JSON/,
      );
      await expectRefused(
        metadataHost.respond('/clients/broken.json', { body: '{"client_id":' }),
        /not valid JSON/,
      );
      await expectRefused(
        metadataHost.respond('/clients/huge.json', {
          body: JSON.stringify({ padding: 'x'.repeat(6 * 1024) }),
        }),
        /larger than/,
      );
    });

    it('refuses client_id URLs without a path, with credentials or with dot segments', async () => {
      await expectRefused(`${metadataHost.origin}/`, /must contain a path/);
      await expectRefused(
        metadataHost.origin.replace('http://', 'http://user:pass@') + '/c.json',
        /must not contain credentials/,
      );
      await expectRefused(
        `${metadataHost.origin}/clients/../clients/1/metadata.json`,
        /dot segments/,
      );
    });

    it('refuses a redirect URI the document does not list, without redirecting to it', async () => {
      const response = await authorizeRequest(publishDocument(), {
        redirect_uri: 'https://attacker.example/steal',
      }).expect(400);

      expect(response.headers.location).toBeUndefined();
      expect(response.body.code).toBe('INVALID_REDIRECT_URI');
    });

    it('does not cache a refused document as a client', async () => {
      const clientId = publishDocument({ client_name: undefined });
      await authorizeRequest(clientId).expect(400);

      expect(await clients.countBy({ clientId })).toBe(0);
    });
  });

  describe('clients that register dynamically', () => {
    it('still registers and connects when it has no metadata document', async () => {
      const client = newClient();

      await client.connect(tasksMcpUrl, 'mcp:use');

      expect(client.registrationMethod).toBe('dynamic_registration');
      expect((await client.callMcp()).status).toBe(200);
    });

    it('can authorize again with the same client_id', async () => {
      // A client that was idle until its refresh token expired starts a new
      // authorization with the client_id it already has.
      const client = newClient();
      const first = await client.connect(tasksMcpUrl, 'mcp:use');

      const second = await client.authorize('mcp:use');

      expect(second.access_token).not.toBe(first.access_token);
      expect((await client.callMcp()).status).toBe(200);
      // and a third time, after an attempt the user abandoned half way
      await openConsentScreen(client.startAuthorization().authorizationUrl);
      await client.authorize('mcp:use');
      expect((await client.callMcp()).status).toBe(200);
    });

    it('does not let an unknown client_id redirect the user anywhere', async () => {
      const response = await authorizeRequest('no-such-client', {
        redirect_uri: 'https://attacker.example/steal',
      }).expect(404);

      expect(response.headers.location).toBeUndefined();
    });

    it('keeps a registered client on the MCP server it registered with', async () => {
      const client = newClient();
      await client.connect(tasksMcpUrl);

      const response = await request(httpServer)
        .get('/api/v1/auth/authorize/mcp/context/0.0.0')
        .query({
          response_type: 'code',
          client_id: client.clientId,
          redirect_uri: REDIRECT_URI,
          state: 'test-state',
          code_challenge: 'a'.repeat(43),
          code_challenge_method: 'S256',
        })
        .expect(302);

      expect(new URL(response.headers.location).searchParams.get('error')).toBe(
        'server_error',
      );
    });
  });

  describe('cleaning up abandoned authorizations', () => {
    const pruneEverythingStale = async () => {
      // Flows untouched for longer than the retention are stale; a negative
      // retention makes that every unfinished flow.
      return app.get(AuthJourneysService).pruneStaleMcpClients(-1);
    };

    it('removes an abandoned attempt but keeps the client and its working tokens', async () => {
      const client = newClient();
      await client.connect(tasksMcpUrl, 'mcp:use');
      const stored = await clients.findOneByOrFail({
        clientId: client.clientId,
      });
      await openConsentScreen(client.startAuthorization().authorizationUrl);
      expect(await flows.countBy({ clientId: stored.id })).toBe(2);

      await pruneEverythingStale();

      expect(await flows.countBy({ clientId: stored.id })).toBe(1);
      expect(await clients.countBy({ id: stored.id })).toBe(1);
      await client.refresh();
      expect((await client.callMcp()).status).toBe(200);
    });

    it('removes a client whose only authorization was abandoned', async () => {
      const clientId = publishDocument();
      const client = newClient(clientId);
      await client.discover(tasksMcpUrl);
      await client.obtainClientId();
      await openConsentScreen(client.startAuthorization().authorizationUrl);
      expect(await clients.countBy({ clientId })).toBe(1);

      await pruneEverythingStale();

      expect(await clients.countBy({ clientId })).toBe(0);
      // the document is simply fetched again the next time the client shows up
      await client.authorize();
      expect((await client.callMcp()).status).toBe(200);
    });
  });
});
