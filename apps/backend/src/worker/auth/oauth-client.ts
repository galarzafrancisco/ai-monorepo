import { createHash, randomBytes } from 'crypto';
import {
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_ID,
} from '../../auth/core/constants/internal-auth-target.constant';
import { createOAuthCallbackServer } from './callback-server';
import type {
  AuthorizationServerMetadata,
  TokenResponse,
  WorkerCredentials,
} from './worker-auth.types';

const WORKER_AUTH_VERSION = '0.0.0';
const WORKER_SCOPE = INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id).join(
  ' ',
);

export async function discoverAuthorizationServer(
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

export async function bootstrapWorkerAuthorization(
  serverUrl: string,
  metadata: AuthorizationServerMetadata,
): Promise<WorkerCredentials> {
  const callback = await createOAuthCallbackServer();
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
      scope: WORKER_SCOPE,
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
  authorizationUrl.searchParams.set('scope', WORKER_SCOPE);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('resource', `${serverUrl}/api/v1`);

  console.log('[worker] Open this URL in your browser to authorize the worker:');
  console.log(authorizationUrl.toString());

  const callbackResult = await callback.waitForCode(state);
  const tokenResponse = await exchangeAuthorizationCode(metadata.token_endpoint, {
    clientId: registration.client_id,
    code: callbackResult.code,
    redirectUri,
    codeVerifier,
  });

  return {
    serverUrl,
    clientId: registration.client_id,
    redirectUri,
    scope: tokenResponse.scope ?? WORKER_SCOPE,
    tokenEndpoint: metadata.token_endpoint,
    authorizationEndpoint: metadata.authorization_endpoint,
    registrationEndpoint: metadata.registration_endpoint,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? '',
    expiresAt: computeExpirationIso(tokenResponse.expires_in),
  };
}

export async function refreshWorkerToken(
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

function computeExpirationIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
