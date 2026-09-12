import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ApiClient } from '@taico/client/v2';
import {
  DISPLAY_AUTH_SCOPES,
  DISPLAY_AUTH_TARGET_ID,
  DISPLAY_AUTH_TARGET_VERSION,
} from '@taico/shared';

const REFRESH_SKEW_MS = 60_000;
const DEFAULT_CREDENTIALS_PATH = join(homedir(), '.taico', 'display-credentials.json');

type Credentials = {
  serverUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export class DisplayAuth {
  private readonly publicClient: ApiClient;
  private credentials: Credentials | null = null;
  private refreshPromise: Promise<Credentials> | null = null;

  constructor(
    private readonly serverUrl: string,
    private readonly credentialsPath = DEFAULT_CREDENTIALS_PATH,
  ) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.publicClient = new ApiClient({ baseUrl: this.serverUrl });
  }

  async getAccessToken(): Promise<string> {
    return (await this.getCredentials()).accessToken;
  }

  async getExpiresAt(): Promise<string> {
    return (await this.getCredentials()).expiresAt;
  }

  async refreshAccessToken(): Promise<string> {
    try {
      if (!this.credentials) {
        await this.getCredentials();
      }
      return (await this.ensureFreshCredentials(true)).accessToken;
    } catch (error) {
      if (!isAuthFailure(error)) {
        throw error;
      }
      this.credentials = await this.authorize();
      await this.persistCredentials(this.credentials);
      return this.credentials.accessToken;
    }
  }

  async getCredentials(): Promise<Credentials> {
    if (!this.credentials) {
      this.credentials = await this.readCredentials();
      if (!this.credentials || !hasDisplayScopes(this.credentials.scope)) {
        this.credentials = await this.authorize();
        await this.persistCredentials(this.credentials);
      }
    }
    try {
      return await this.ensureFreshCredentials();
    } catch (error) {
      if (!isAuthFailure(error)) {
        throw error;
      }
      this.credentials = await this.authorize();
      await this.persistCredentials(this.credentials);
      return this.credentials;
    }
  }

  private async ensureFreshCredentials(force = false): Promise<Credentials> {
    if (!this.credentials) throw new Error('Display credentials are not loaded.');
    if (
      !force &&
      Date.parse(this.credentials.expiresAt) - Date.now() > REFRESH_SKEW_MS
    ) {
      return this.credentials;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(this.credentials);
    }
    try {
      this.credentials = await this.refreshPromise;
      await this.persistCredentials(this.credentials);
      return this.credentials;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async authorize(): Promise<Credentials> {
    const callback = await createCallbackServer();
    try {
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const metadata =
        await this.publicClient.discovery.DiscoveryController_getAuthorizationServerMetadata(
          {
            mcpServerId: DISPLAY_AUTH_TARGET_ID,
            version: DISPLAY_AUTH_TARGET_VERSION,
          },
        );
      const registration =
        await this.publicClient.authorizationServer.ClientRegistrationController_registerClient(
          {
            serverId: DISPLAY_AUTH_TARGET_ID,
            version: DISPLAY_AUTH_TARGET_VERSION,
            body: {
              client_name: `Taico Display (${process.pid})`,
              redirect_uris: [callback.redirectUri],
              grant_types: ['authorization_code', 'refresh_token'],
              response_types: ['code'],
              token_endpoint_auth_method: 'none',
              scope: getDisplayScope(),
            },
          },
        );
      const state = randomBytes(16).toString('base64url');
      const authorizationUrl = new URL(metadata.authorization_endpoint);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('client_id', registration.client_id);
      authorizationUrl.searchParams.set('redirect_uri', callback.redirectUri);
      authorizationUrl.searchParams.set('scope', getDisplayScope());
      authorizationUrl.searchParams.set('state', state);
      authorizationUrl.searchParams.set('code_challenge', challenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');
      authorizationUrl.searchParams.set('resource', `${this.serverUrl}/api/v1`);
      console.log('[display] Open this URL to authorize the display:');
      console.log(authorizationUrl.toString());
      const code = await callback.waitForCode(state);
      const token =
        await this.publicClient.authorizationServer.AuthorizationController_token({
          serverIdentifier: DISPLAY_AUTH_TARGET_ID,
          version: DISPLAY_AUTH_TARGET_VERSION,
          body: {
            grant_type: 'authorization_code',
            client_id: registration.client_id,
            code,
            redirect_uri: callback.redirectUri,
            code_verifier: verifier,
          },
        });

      return {
        serverUrl: this.serverUrl,
        clientId: registration.client_id,
        redirectUri: callback.redirectUri,
        scope: token.scope ?? getDisplayScope(),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: expiration(token.expires_in),
      };
    } finally {
      await callback.close();
    }
  }

  private async refresh(credentials: Credentials): Promise<Credentials> {
    const token =
      await this.publicClient.authorizationServer.AuthorizationController_token({
        serverIdentifier: DISPLAY_AUTH_TARGET_ID,
        version: DISPLAY_AUTH_TARGET_VERSION,
        body: {
          grant_type: 'refresh_token',
          client_id: credentials.clientId,
          refresh_token: credentials.refreshToken,
        },
      });

    return {
      ...credentials,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scope: token.scope ?? credentials.scope,
      expiresAt: expiration(token.expires_in),
    };
  }

  private async readCredentials(): Promise<Credentials | null> {
    try {
      const config = JSON.parse(await readFile(this.credentialsPath, 'utf8')) as { servers?: Record<string, Credentials> };
      return config.servers?.[this.serverUrl] ?? null;
    } catch {
      return null;
    }
  }

  private async persistCredentials(credentials: Credentials): Promise<void> {
    await mkdir(dirname(this.credentialsPath), { recursive: true, mode: 0o700 });
    let servers: Record<string, Credentials> = {};
    try {
      const config = JSON.parse(await readFile(this.credentialsPath, 'utf8')) as {
        servers?: Record<string, Credentials>;
      };
      servers = config.servers ?? {};
    } catch {
      // Create a new credential store.
    }
    servers[this.serverUrl] = credentials;
    await writeFile(this.credentialsPath, JSON.stringify({ servers }, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await chmod(this.credentialsPath, 0o600);
  }
}

function getDisplayScope(): string {
  return DISPLAY_AUTH_SCOPES.map(({ id }) => id).join(' ');
}

function expiration(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function hasDisplayScopes(value: string): boolean {
  const granted = new Set(value.split(/\s+/));
  return DISPLAY_AUTH_SCOPES.every(({ id }) => granted.has(id));
}

async function createCallbackServer(): Promise<{
  redirectUri: string;
  waitForCode: (state: string) => Promise<string>;
  close: () => Promise<void>;
}> {
  const server = createServer();
  let resolveCode: ((value: { code: string; state: string }) => void) | undefined;
  let rejectCode: ((error: Error) => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const close = async (): Promise<void> => {
    if (timeout) clearTimeout(timeout);
    if (!server.listening) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  server.on('request', (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    response.statusCode = code && state ? 200 : 400;
    response.end(code && state ? 'Taico display authorized. You can close this tab.' : 'Missing code or state.');
    if (code && state) resolveCode?.({ code, state });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind OAuth callback server.');
  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    waitForCode: (expectedState) =>
      new Promise((resolve, reject) => {
        const fail = (error: Error) => {
          void close();
          reject(error);
        };
        resolveCode = ({ code, state }) => {
          void close();
          if (state === expectedState) {
            resolve(code);
            return;
          }
          reject(new Error('OAuth callback state mismatch.'));
        };
        rejectCode = fail;
        server.once('error', fail);
        timeout = setTimeout(
          () => fail(new Error('Timed out waiting for OAuth callback.')),
          5 * 60_000,
        );
      }),
    close: async () => {
      rejectCode = undefined;
      resolveCode = undefined;
      await close();
    },
  };
}

function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}
