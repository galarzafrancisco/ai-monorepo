import { createHash, randomBytes } from 'crypto';
import { ApiClient } from '@taico/client/v2';
import {
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_ID,
  INTERNAL_WORKER_AUTH_TARGET_VERSION,
} from '@taico/shared';
import { createOAuthCallbackServer } from './callback-server.js';
import {
  DEFAULT_WORKER_CREDENTIALS_PATH,
  readWorkerCredentials,
  writeWorkerCredentials,
} from './credentials-store.js';
import type { WorkerCredentials } from './worker-auth.types.js';

const REFRESH_SKEW_MS = 60_000;

type WorkerAuthOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

type BootstrapResult = {
  credentials: WorkerCredentials;
  didBootstrap: boolean;
};

export class WorkerAuth {
  private readonly publicClient: ApiClient;
  private readonly credentialsPath: string;
  private credentials: WorkerCredentials | null = null;
  private bootstrapPromise: Promise<BootstrapResult> | null = null;
  private refreshPromise: Promise<WorkerCredentials> | null = null;

  constructor(private readonly options: WorkerAuthOptions) {
    this.credentialsPath =
      options.credentialsPath ?? DEFAULT_WORKER_CREDENTIALS_PATH;
    this.publicClient = new ApiClient({
      baseUrl: normalizeBaseUrl(options.serverUrl),
    });
  }

  get serverUrl(): string {
    return normalizeBaseUrl(this.options.serverUrl);
  }

  getCredentialsPath(): string {
    return this.credentialsPath;
  }

  async ensureAuthenticated(): Promise<BootstrapResult> {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.bootstrapPromise = this.bootstrap();

    try {
      return await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  async getCredentials(): Promise<WorkerCredentials> {
    await this.ensureAuthenticated();
    return this.ensureFreshCredentials();
  }

  async getAccessToken(): Promise<string> {
    const credentials = await this.getCredentials();
    return credentials.accessToken;
  }

  async refreshAccessToken(): Promise<string> {
    const credentials = await this.ensureFreshCredentials(true);
    return credentials.accessToken;
  }

  private async bootstrap(): Promise<BootstrapResult> {
    const requiredScopes = new Set(
      INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id),
    );

    const storedCredentials = await readWorkerCredentials(this.credentialsPath);
    if (
      storedCredentials &&
      storedCredentials.serverUrl === this.serverUrl &&
      hasRequiredScopes(storedCredentials, requiredScopes)
    ) {
      this.credentials = storedCredentials;
      try {
        const credentials = await this.ensureFreshCredentials();
        await this.assertCredentialsWork(credentials);
        return { credentials, didBootstrap: false };
      } catch (error) {
        if (!isAuthFailure(error)) {
          throw error;
        }

        this.credentials = null;
      }
    }

    const credentials = await this.bootstrapFromBrowserAuthorization();
    this.credentials = credentials;
    await writeWorkerCredentials(this.credentialsPath, credentials);

    return { credentials, didBootstrap: true };
  }

  private async ensureFreshCredentials(
    forceRefresh = false,
  ): Promise<WorkerCredentials> {
    if (!this.credentials) {
      throw new Error('WorkerAuth has no credentials loaded.');
    }

    if (!forceRefresh && !isExpiringSoon(this.credentials)) {
      return this.credentials;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshCredentials(this.credentials);

    try {
      this.credentials = await this.refreshPromise;
      await writeWorkerCredentials(this.credentialsPath, this.credentials);
      return this.credentials;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async bootstrapFromBrowserAuthorization(): Promise<WorkerCredentials> {
    const callback = await createOAuthCallbackServer();
    const redirectUri = callback.redirectUri;
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const metadata =
      await this.publicClient.discovery.DiscoveryController_getAuthorizationServerMetadata(
        {
          mcpServerId: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
        },
      );

    const registration =
      await this.publicClient.authorizationServer.ClientRegistrationController_registerClient(
        {
          serverId: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
          body: {
            client_name: `Taico Worker (${process.pid})`,
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            scope: getWorkerScope(),
          },
        },
      );

    const state = randomBytes(16).toString('base64url');
    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', registration.client_id);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('scope', getWorkerScope());
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('resource', `${this.serverUrl}/api/v1`);

    console.log('[worker] Open this URL in your browser to authorize the worker:');
    console.log(authorizationUrl.toString());

    const callbackResult = await callback.waitForCode(state);
    const tokenResponse =
      await this.publicClient.authorizationServer.AuthorizationController_token(
        {
          serverIdentifier: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
          body: {
            grant_type: 'authorization_code',
            client_id: registration.client_id,
            code: callbackResult.code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          },
        },
      );

    return {
      serverUrl: this.serverUrl,
      clientId: registration.client_id,
      redirectUri,
      scope: tokenResponse.scope ?? getWorkerScope(),
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: computeExpirationIso(tokenResponse.expires_in),
    };
  }

  private async refreshCredentials(
    credentials: WorkerCredentials,
  ): Promise<WorkerCredentials> {
    const tokenResponse =
      await this.publicClient.authorizationServer.AuthorizationController_token(
        {
          serverIdentifier: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
          body: {
            grant_type: 'refresh_token',
            client_id: credentials.clientId,
            refresh_token: credentials.refreshToken,
          },
        },
      );

    return {
      ...credentials,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: computeExpirationIso(tokenResponse.expires_in),
      scope: tokenResponse.scope ?? credentials.scope,
    };
  }

  private async assertCredentialsWork(
    credentials: WorkerCredentials,
  ): Promise<void> {
    const introspection =
      await this.publicClient.authorizationServer.AuthorizationController_introspect(
        {
          serverIdentifier: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
          body: {
            token: credentials.accessToken,
            client_id: credentials.clientId,
            token_type_hint: 'access_token',
          },
        },
      );

    if (introspection.active) {
      return;
    }

    const refreshedCredentials = await this.ensureFreshCredentials(true);
    const refreshedIntrospection =
      await this.publicClient.authorizationServer.AuthorizationController_introspect(
        {
          serverIdentifier: INTERNAL_WORKER_AUTH_TARGET_ID,
          version: INTERNAL_WORKER_AUTH_TARGET_VERSION,
          body: {
            token: refreshedCredentials.accessToken,
            client_id: refreshedCredentials.clientId,
            token_type_hint: 'access_token',
          },
        },
      );

    if (!refreshedIntrospection.active) {
      throw new Error('HTTP 401: Stored worker credentials are no longer active.');
    }
  }
}

function computeExpirationIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function getWorkerScope(): string {
  return INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id).join(' ');
}

function hasRequiredScopes(
  credentials: WorkerCredentials,
  requiredScopes: Set<string>,
): boolean {
  const grantedScopes = new Set(
    credentials.scope
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );

  return Array.from(requiredScopes).every((scope) => grantedScopes.has(scope));
}

function isExpiringSoon(credentials: WorkerCredentials): boolean {
  const expiresAt = Date.parse(credentials.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_SKEW_MS;
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

function isAuthFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith('HTTP 401:') ||
      error.message.startsWith('HTTP 403:'))
  );
}
