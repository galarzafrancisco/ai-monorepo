import { createHash, randomBytes } from 'crypto';
import { createServer } from 'http';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import {
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_ID,
} from '../auth/core/constants/internal-auth-target.constant';

const WORKER_AUTH_VERSION = '0.0.0';
const DEFAULT_CREDENTIALS_PATH = join(
  homedir(),
  '.taico',
  'worker-credentials.json',
);

type WorkerModeOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
};

type WorkerCredentials = {
  serverUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  tokenEndpoint: string;
  authorizationEndpoint: string;
  registrationEndpoint: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type AgentSummary = {
  actorId: string;
  slug: string;
  name: string;
};

export async function runWorkerMode(options: WorkerModeOptions): Promise<void> {
  const serverUrl = normalizeBaseUrl(options.serverUrl);
  const credentialsPath = options.credentialsPath ?? DEFAULT_CREDENTIALS_PATH;

  console.log(`[worker] Starting worker mode against ${serverUrl}`);

  const metadata = await discoverAuthorizationServer(serverUrl);
  let credentials = await readCredentials(credentialsPath);

  if (!credentials || credentials.serverUrl !== serverUrl) {
    credentials = await bootstrapWorkerAuthorization(serverUrl, metadata);
    await writeCredentials(credentialsPath, credentials);
    console.log(`[worker] Stored credentials at ${credentialsPath}`);
  }

  credentials = await refreshWorkerToken(credentials);
  await writeCredentials(credentialsPath, credentials);
  console.log('[worker] Refresh succeeded');

  const agents = await listAgents(serverUrl, credentials.accessToken);
  console.log(`[worker] Loaded ${agents.length} agent(s)`);

  if (agents.length === 0) {
    console.log('[worker] No agents available. Stopping after auth smoke test.');
    return;
  }

  const agent = agents[0];
  console.log(`[worker] Requesting execution token for @${agent.slug}`);
  const executionToken = await requestAgentExecutionToken(
    serverUrl,
    credentials.accessToken,
    agent.slug,
  );

  const createdTask = await createSmokeTask(
    serverUrl,
    executionToken.token,
    agent.actorId,
  );

  console.log(
    `[worker] Smoke task created as @${agent.slug}: ${createdTask.id} "${createdTask.name}"`,
  );
}

async function discoverAuthorizationServer(
  serverUrl: string,
): Promise<AuthorizationServerMetadata> {
  const discoveryUrl = `${serverUrl}/.well-known/oauth-authorization-server/mcp/${INTERNAL_WORKER_AUTH_TARGET_ID}/${WORKER_AUTH_VERSION}`;
  const response = await fetch(discoveryUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to discover authorization server metadata: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<AuthorizationServerMetadata>;
}

async function bootstrapWorkerAuthorization(
  serverUrl: string,
  metadata: AuthorizationServerMetadata,
): Promise<WorkerCredentials> {
  const callback = await createCallbackServer();
  const redirectUri = callback.redirectUri;
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const registrationResponse = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: `Taico Worker (${process.pid})`,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id).join(' '),
    }),
  });

  if (!registrationResponse.ok) {
    throw new Error(
      `Failed to register worker client: ${registrationResponse.status} ${registrationResponse.statusText}`,
    );
  }

  const registration = (await registrationResponse.json()) as {
    client_id: string;
  };

  const state = randomBytes(16).toString('base64url');
  const authorizationUrl = new URL(metadata.authorization_endpoint);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', registration.client_id);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('scope', INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id).join(' '));
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('resource', `${serverUrl}/api/v1`);

  console.log('[worker] Open this URL in your browser to authorize the worker:');
  console.log(authorizationUrl.toString());

  const callbackResult = await callback.waitForCode(state);

  const tokenResponse = await exchangeAuthorizationCode(
    metadata.token_endpoint,
    {
      clientId: registration.client_id,
      code: callbackResult.code,
      redirectUri,
      codeVerifier,
    },
  );

  return {
    serverUrl,
    clientId: registration.client_id,
    redirectUri,
    scope:
      tokenResponse.scope ??
      INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id).join(' '),
    tokenEndpoint: metadata.token_endpoint,
    authorizationEndpoint: metadata.authorization_endpoint,
    registrationEndpoint: metadata.registration_endpoint,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? '',
    expiresAt: computeExpirationIso(tokenResponse.expires_in),
  };
}

async function exchangeAuthorizationCode(
  tokenEndpoint: string,
  input: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  },
): Promise<TokenResponse> {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to exchange authorization code: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

async function refreshWorkerToken(
  credentials: WorkerCredentials,
): Promise<WorkerCredentials> {
  const response = await fetch(credentials.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to refresh worker token: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as TokenResponse;

  return {
    ...credentials,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? credentials.refreshToken,
    expiresAt: computeExpirationIso(payload.expires_in),
    scope: payload.scope ?? credentials.scope,
  };
}

async function listAgents(
  serverUrl: string,
  accessToken: string,
): Promise<AgentSummary[]> {
  const response = await fetch(`${serverUrl}/api/v1/agents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list agents: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    items: Array<{ actorId: string; slug: string; name: string }>;
  };

  return payload.items;
}

async function requestAgentExecutionToken(
  serverUrl: string,
  accessToken: string,
  agentSlug: string,
): Promise<{ token: string }> {
  const response = await fetch(
    `${serverUrl}/api/v1/agents/${agentSlug}/execution-token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scopes: ['tasks:read', 'tasks:write'],
        expirationSeconds: 600,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to request execution token: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<{ token: string }>;
}

async function createSmokeTask(
  serverUrl: string,
  accessToken: string,
  assigneeActorId: string,
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${serverUrl}/api/v1/tasks/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Worker auth smoke test ${new Date().toISOString()}`,
      description:
        'Created by taico worker-mode OAuth smoke test to verify agent execution token flow.',
      assigneeActorId,
      tagNames: ['system:worker-auth-smoke'],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create smoke task: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<{ id: string; name: string }>;
}

async function readCredentials(
  credentialsPath: string,
): Promise<WorkerCredentials | null> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    return JSON.parse(content) as WorkerCredentials;
  } catch {
    return null;
  }
}

async function writeCredentials(
  credentialsPath: string,
  credentials: WorkerCredentials,
): Promise<void> {
  await mkdir(dirname(credentialsPath), { recursive: true });
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

function computeExpirationIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

async function createCallbackServer(): Promise<{
  redirectUri: string;
  waitForCode: (expectedState: string) => Promise<{ code: string }>;
}> {
  const server = createServer();
  let pendingResolve:
    | ((value: { code: string; state: string }) => void)
    | null = null;

  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      res.statusCode = 400;
      res.end('Missing code or state');
      return;
    }

    res.statusCode = 200;
    res.end('Taico worker authorization completed. You can close this tab.');

    if (pendingResolve) {
      pendingResolve({ code, state });
      pendingResolve = null;
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local callback server');
  }

  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  return {
    redirectUri,
    waitForCode: async (expectedState: string) => {
      const result = await new Promise<{ code: string; state: string }>(
        (resolve) => {
          pendingResolve = resolve;
        },
      );
      server.close();
      if (result.state !== expectedState) {
        throw new Error('OAuth callback state mismatch');
      }
      return { code: result.code };
    },
  };
}
