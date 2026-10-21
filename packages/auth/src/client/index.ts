import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';

/*
 * The other side of the flow: an OAuth client for CLIs, workers and tests.
 * Discovers a server, registers, runs the authorization code flow with PKCE
 * and keeps the tokens fresh. Works against any RFC 8414 server.
 */

export type ServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  scope: string;
  /** ISO timestamp */
  expiresAt: string;
};

export type Credentials = TokenSet & {
  issuer: string;
  /** The resource (RFC 8707) the tokens were issued for */
  resource?: string;
  clientId: string;
  redirectUri: string;
};

export class OAuthClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly error?: string,
  ) {
    super(message);
    this.name = 'OAuthClientError';
  }

  /** True when the server refused the credentials, so re-authorizing may help */
  get isAuthFailure(): boolean {
    return this.status === 400 || this.status === 401 || this.status === 403;
  }
}

export type OAuthClientOptions = {
  /** Issuer URL; metadata is read from its well-known location */
  issuer: string;
  /** Skip discovery by supplying the metadata */
  metadata?: ServerMetadata;
  /** A client_id obtained earlier, or a metadata document URL */
  clientId?: string;
  fetch?: typeof fetch;
};

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  return {
    codeVerifier,
    codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
  };
}

export class OAuthClient {
  private metadataPromise: Promise<ServerMetadata> | null = null;
  clientId: string | undefined;

  constructor(private readonly options: OAuthClientOptions) {
    this.clientId = options.clientId;
  }

  /** The issuer this client talks to */
  get issuer(): string {
    return this.options.issuer;
  }

  private get fetch(): typeof fetch {
    return this.options.fetch ?? fetch;
  }

  /** The server's RFC 8414 metadata, fetched once */
  discover(): Promise<ServerMetadata> {
    if (this.options.metadata) {
      return Promise.resolve(this.options.metadata);
    }
    this.metadataPromise ??= (async () => {
      const issuer = new URL(this.options.issuer);
      const path = issuer.pathname === '/' ? '' : issuer.pathname.replace(/\/$/, '');
      const url = `${issuer.origin}/.well-known/oauth-authorization-server${path}`;
      const response = await this.fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        throw new OAuthClientError(
          `Discovery failed: ${url} responded with HTTP ${response.status}`,
          response.status,
        );
      }
      return (await response.json()) as ServerMetadata;
    })();
    this.metadataPromise.catch(() => {
      this.metadataPromise = null;
    });
    return this.metadataPromise;
  }

  private async post<T>(url: string, body: Record<string, unknown>, form: boolean): Promise<T> {
    const entries = Object.entries(body).filter(([, value]) => value !== undefined);
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      body: form
        ? new URLSearchParams(
            entries.map(([key, value]): [string, string] => [key, String(value)]),
          ).toString()
        : JSON.stringify(Object.fromEntries(entries)),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new OAuthClientError(
        `HTTP ${response.status}: ${String(payload.error_description ?? payload.error ?? payload.detail ?? 'request failed')}`,
        response.status,
        typeof payload.error === 'string' ? payload.error : undefined,
      );
    }
    return payload as T;
  }

  /** Registers as a public client (RFC 7591) and remembers the client_id */
  async register(input: {
    clientName: string;
    redirectUris: string[];
    scope?: string;
  }): Promise<string> {
    const { registration_endpoint } = await this.discover();
    if (!registration_endpoint) {
      throw new Error('The server does not support dynamic client registration');
    }
    const registered = await this.post<{ client_id: string }>(
      registration_endpoint,
      {
        client_name: input.clientName,
        redirect_uris: input.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: input.scope,
      },
      false,
    );
    this.clientId = registered.client_id;
    return registered.client_id;
  }

  private requireClientId(): string {
    if (!this.clientId) {
      throw new Error('No client_id: call register() or pass clientId');
    }
    return this.clientId;
  }

  /** Builds the URL to send the user to, and what to keep for the callback */
  async createAuthorizationRequest(input: {
    redirectUri: string;
    scope?: string;
    resource?: string;
  }): Promise<{ url: string; state: string; codeVerifier: string }> {
    const { authorization_endpoint } = await this.discover();
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = randomBytes(16).toString('base64url');
    const url = new URL(authorization_endpoint);
    const params: Record<string, string | undefined> = {
      response_type: 'code',
      client_id: this.requireClientId(),
      redirect_uri: input.redirectUri,
      scope: input.scope,
      resource: input.resource,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    };
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, value);
    }
    return { url: url.toString(), state, codeVerifier };
  }

  private toTokenSet(
    response: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    },
    previous?: Pick<TokenSet, 'scope' | 'refreshToken'>,
  ): TokenSet {
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? previous?.refreshToken,
      scope: response.scope ?? previous?.scope ?? '',
      expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
    };
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    resource?: string;
  }): Promise<TokenSet> {
    const { token_endpoint } = await this.discover();
    return this.toTokenSet(
      await this.post(
        token_endpoint,
        {
          grant_type: 'authorization_code',
          client_id: this.requireClientId(),
          code: input.code,
          code_verifier: input.codeVerifier,
          redirect_uri: input.redirectUri,
          resource: input.resource,
        },
        true,
      ),
    );
  }

  /** Exchanges a refresh token. The server rotates it: keep the new one. */
  async refresh(tokens: Pick<TokenSet, 'refreshToken' | 'scope'>): Promise<TokenSet> {
    if (!tokens.refreshToken) {
      throw new Error('No refresh token');
    }
    const { token_endpoint } = await this.discover();
    return this.toTokenSet(
      await this.post(
        token_endpoint,
        {
          grant_type: 'refresh_token',
          client_id: this.requireClientId(),
          refresh_token: tokens.refreshToken,
        },
        true,
      ),
      tokens,
    );
  }

  async introspect(token: string): Promise<{ active: boolean } & Record<string, unknown>> {
    const { introspection_endpoint } = await this.discover();
    if (!introspection_endpoint) {
      throw new Error('The server does not support introspection');
    }
    return this.post(introspection_endpoint, { token, client_id: this.clientId }, true);
  }

  async revoke(token: string): Promise<void> {
    const { revocation_endpoint } = await this.discover();
    if (!revocation_endpoint) {
      throw new Error('The server does not support revocation');
    }
    await this.post(revocation_endpoint, { token }, true);
  }
}

/** True when a token set expires within `skewMs` (default one minute) */
export function isExpiringSoon(tokens: Pick<TokenSet, 'expiresAt'>, skewMs = 60_000): boolean {
  const expiresAt = Date.parse(tokens.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt - Date.now() <= skewMs;
}

// ---------------------------------------------------------------- resource discovery

/** What a protected resource says about itself (RFC 9728) */
export type DiscoveredResource = {
  /** The resource identifier to request tokens for, from its metadata */
  resource: string;
  /** Authorization servers that issue tokens for it; the first is used */
  authorizationServers: string[];
  scopesSupported: string[];
  /** Scopes the resource's 401 challenge asked for, if any */
  challengeScope?: string;
  /** Where the metadata was read from */
  metadataUrl: string;
};

const WELL_KNOWN_RESOURCE = '/.well-known/oauth-protected-resource';

/** A parameter of a `WWW-Authenticate: Bearer` header, or undefined */
function challengeParam(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = new RegExp(`(?:^|[\\s,])${name}="((?:[^"\\\\]|\\\\.)*)"`, 'i').exec(header);
  return match ? match[1].replace(/\\(.)/g, '$1') : undefined;
}

/** True when `url` is `resource` or a path below it, on the same origin */
function isUnderResource(url: URL, resource: URL): boolean {
  if (url.origin !== resource.origin) return false;
  const base = resource.pathname.replace(/\/$/, '');
  const path = url.pathname.replace(/\/$/, '');
  return path === base || path.startsWith(`${base}/`);
}

/**
 * Finds a resource's authorization server from nothing but its URL, the way
 * MCP clients do: call it without a token, follow `resource_metadata` in the
 * 401 (RFC 9728 section 5), else try the well-known locations (section 3).
 * The metadata must describe `resourceUrl` or a URL it falls under.
 */
export async function discoverResource(
  resourceUrl: string,
  options: { fetch?: typeof fetch } = {},
): Promise<DiscoveredResource> {
  const doFetch = options.fetch ?? fetch;
  const target = new URL(resourceUrl);
  target.hash = '';

  const candidates: string[] = [];
  let challengeScope: string | undefined;
  const probe = await doFetch(target, { headers: { accept: 'application/json' } }).catch(
    () => null,
  );
  if (probe?.status === 401) {
    const header = probe.headers.get('www-authenticate');
    const fromChallenge = challengeParam(header, 'resource_metadata');
    challengeScope = challengeParam(header, 'scope');
    if (fromChallenge) {
      candidates.push(new URL(fromChallenge, target).href);
    }
  }
  await probe?.body?.cancel().catch(() => undefined);
  const path = target.pathname === '/' ? '' : target.pathname.replace(/\/$/, '');
  candidates.push(`${target.origin}${WELL_KNOWN_RESOURCE}${path}`);
  candidates.push(`${target.origin}${WELL_KNOWN_RESOURCE}`);

  const failures: string[] = [];
  for (const metadataUrl of [...new Set(candidates)]) {
    const response = await doFetch(metadataUrl, { headers: { accept: 'application/json' } }).catch(
      (error: unknown) => {
        failures.push(`${metadataUrl}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      },
    );
    if (!response) continue;
    if (!response.ok) {
      failures.push(`${metadataUrl}: HTTP ${response.status}`);
      continue;
    }
    const metadata = (await response.json().catch(() => null)) as {
      resource?: unknown;
      authorization_servers?: unknown;
      scopes_supported?: unknown;
    } | null;
    let resource: URL | null = null;
    try {
      resource = typeof metadata?.resource === 'string' ? new URL(metadata.resource) : null;
    } catch {
      resource = null;
    }
    // Metadata for another resource must not redirect our tokens (RFC 9728 section 7.3)
    if (!resource || !isUnderResource(target, resource)) {
      failures.push(`${metadataUrl}: describes another resource`);
      continue;
    }
    const servers = Array.isArray(metadata?.authorization_servers)
      ? metadata.authorization_servers.filter((value): value is string => typeof value === 'string')
      : [];
    if (servers.length === 0) {
      failures.push(`${metadataUrl}: names no authorization server`);
      continue;
    }
    return {
      resource: metadata!.resource as string,
      authorizationServers: servers,
      scopesSupported: Array.isArray(metadata?.scopes_supported)
        ? metadata.scopes_supported.filter((value): value is string => typeof value === 'string')
        : [],
      challengeScope,
      metadataUrl,
    };
  }
  throw new OAuthClientError(
    `No protected resource metadata for ${target.href} (${failures.join('; ')})`,
    404,
  );
}

// ---------------------------------------------------------------- loopback callback

export type CallbackServer = {
  redirectUri: string;
  /** Resolves with the code once the browser comes back with `expectedState` */
  waitForCode(expectedState: string, timeoutMs?: number): Promise<{ code: string }>;
  close(): void;
};

/**
 * Listens on a random loopback port for the authorization response, the way
 * native apps receive it (RFC 8252 section 7.3).
 */
export async function createCallbackServer(
  options: { successHtml?: string; path?: string } = {},
): Promise<CallbackServer> {
  const path = options.path ?? '/callback';
  const server = createServer();
  let settle: ((result: URLSearchParams) => void) | null = null;
  // Responses that arrive before waitForCode() is called are kept for it
  const early: URLSearchParams[] = [];

  server.on('request', (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== path || !url.searchParams.has('state')) {
      response.statusCode = 400;
      response.end('Missing state');
      return;
    }
    response.statusCode = 200;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(
      options.successHtml ??
        '<!doctype html><title>Authorized</title><p>You can close this window.</p>',
    );
    if (settle) {
      settle(url.searchParams);
    } else {
      early.push(url.searchParams);
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
    throw new Error('Failed to bind the callback server');
  }
  const close = () => {
    server.close();
    server.closeAllConnections();
  };

  return {
    redirectUri: `http://127.0.0.1:${address.port}${path}`,
    close,
    waitForCode(expectedState, timeoutMs = 5 * 60_000) {
      return new Promise<{ code: string }>((resolve, reject) => {
        const timer = setTimeout(() => {
          close();
          reject(new Error('Timed out waiting for the authorization response'));
        }, timeoutMs);
        timer.unref();
        settle = (params) => {
          // Responses for another request are ignored, not treated as ours
          if (params.get('state') !== expectedState) {
            return;
          }
          clearTimeout(timer);
          close();
          const code = params.get('code');
          if (code) {
            resolve({ code });
          } else {
            reject(
              new OAuthClientError(
                `Authorization failed: ${params.get('error_description') ?? params.get('error') ?? 'no code returned'}`,
                400,
                params.get('error') ?? undefined,
              ),
            );
          }
        };
        for (const params of early.splice(0)) {
          settle(params);
        }
      });
    },
  };
}

// ---------------------------------------------------------------- credential store

/**
 * Where a `TokenManager` keeps credentials, per issuer and resource: two
 * resources behind one authorization server each get their own tokens.
 */
export interface CredentialStore {
  read(issuer: string, resource?: string): Promise<Credentials | null>;
  write(credentials: Credentials): Promise<void>;
}

/** Key credentials are filed under. A space appears in neither URL. */
export function credentialKey(issuer: string, resource?: string): string {
  return resource ? `${issuer} ${resource}` : issuer;
}

/** Credentials in a JSON file, keyed by issuer and resource, readable only by the owner */
export function fileCredentialStore(filePath: string): CredentialStore {
  const readAll = async (): Promise<Record<string, Credentials>> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      const servers = (parsed as { servers?: unknown } | null)?.servers;
      return typeof servers === 'object' && servers !== null
        ? (servers as Record<string, Credentials>)
        : {};
    } catch {
      return {};
    }
  };
  return {
    async read(issuer, resource) {
      return (await readAll())[credentialKey(issuer, resource)] ?? null;
    },
    async write(credentials) {
      const servers = {
        ...(await readAll()),
        [credentialKey(credentials.issuer, credentials.resource)]: credentials,
      };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify({ servers }, null, 2)}\n`, {
        mode: 0o600,
      });
    },
  };
}

export function memoryCredentialStore(): CredentialStore {
  const servers = new Map<string, Credentials>();
  return {
    read: async (issuer, resource) => servers.get(credentialKey(issuer, resource)) ?? null,
    write: async (credentials) => {
      servers.set(credentialKey(credentials.issuer, credentials.resource), credentials);
    },
  };
}

// ---------------------------------------------------------------- token manager

export type TokenManagerOptions = {
  store: CredentialStore;
  clientName: string;
  /** Scopes to ask for. With discovery, defaults to what the resource asks for. */
  scope?: string;
  /**
   * The resource the tokens are for (RFC 8707). Credentials are kept per
   * issuer and resource. On its own it is enough: the issuer is discovered
   * from the resource's metadata.
   */
  resource?: string;
  /** The authorization server. Discovered from `resource` when omitted. */
  issuer?: string;
  /** The client to use. Created for the issuer when omitted. */
  client?: OAuthClient;
  fetch?: typeof fetch;
  /** Shows the user the URL to open. Defaults to printing it. */
  onAuthorizationUrl?: (url: string) => void | Promise<void>;
};

type ResolvedTarget = {
  client: OAuthClient;
  issuer: string;
  resource?: string;
  scope?: string;
};

/**
 * Keeps a working access token: loads stored credentials, refreshes them
 * before they expire, and runs the browser flow when there are none or they
 * were refused.
 *
 * new TokenManager({ resource: 'https://notes.example.com/mcp', store, clientName })
 */
export class TokenManager {
  private credentials: Credentials | null = null;
  private pending: Promise<Credentials> | null = null;
  private target: Promise<ResolvedTarget> | null = null;

  constructor(private readonly options: TokenManagerOptions) {
    if (!options.issuer && !options.client && !options.resource) {
      throw new Error('TokenManager needs an issuer, a client or a resource');
    }
  }

  async getAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
    this.pending ??= this.ensure(options.forceRefresh ?? false).finally(() => {
      this.pending = null;
    });
    return (await this.pending).accessToken;
  }

  /** Issuer, resource and scope, discovering what was not given. Done once. */
  resolve(): Promise<ResolvedTarget> {
    this.target ??= (async () => {
      const { resource, scope, fetch: doFetch } = this.options;
      const issuer = this.options.issuer ?? this.options.client?.issuer;
      if (issuer) {
        return {
          client: this.options.client ?? new OAuthClient({ issuer, fetch: doFetch }),
          issuer,
          resource,
          scope,
        };
      }
      const discovered = await discoverResource(resource!, { fetch: doFetch });
      const found = discovered.authorizationServers[0];
      return {
        client: new OAuthClient({ issuer: found, fetch: doFetch }),
        issuer: found,
        resource: discovered.resource,
        scope:
          scope ??
          discovered.challengeScope ??
          (discovered.scopesSupported.length > 0
            ? discovered.scopesSupported.join(' ')
            : undefined),
      };
    })();
    this.target.catch(() => {
      this.target = null;
    });
    return this.target;
  }

  private async ensure(forceRefresh: boolean): Promise<Credentials> {
    const { client, issuer, resource } = await this.resolve();
    this.credentials ??= await this.options.store.read(issuer, resource);

    if (this.credentials) {
      client.clientId = this.credentials.clientId;
      if (!forceRefresh && !isExpiringSoon(this.credentials)) {
        return this.credentials;
      }
      try {
        return await this.save({
          ...this.credentials,
          ...(await client.refresh(this.credentials)),
        });
      } catch (error) {
        if (!(error instanceof OAuthClientError) || !error.isAuthFailure) {
          throw error;
        }
        this.credentials = null;
      }
    }
    return this.authorize();
  }

  private async authorize(): Promise<Credentials> {
    const { client, issuer, resource, scope } = await this.resolve();
    const callback = await createCallbackServer();
    try {
      const clientId = await client.register({
        clientName: this.options.clientName,
        redirectUris: [callback.redirectUri],
        scope,
      });
      const request = await client.createAuthorizationRequest({
        redirectUri: callback.redirectUri,
        scope,
        resource,
      });
      await (this.options.onAuthorizationUrl ?? ((url) => console.log(url)))(request.url);
      const { code } = await callback.waitForCode(request.state);
      const tokens = await client.exchangeCode({
        code,
        codeVerifier: request.codeVerifier,
        redirectUri: callback.redirectUri,
        resource,
      });
      return await this.save({
        ...tokens,
        issuer,
        resource,
        clientId,
        redirectUri: callback.redirectUri,
      });
    } finally {
      callback.close();
    }
  }

  private async save(credentials: Credentials): Promise<Credentials> {
    this.credentials = credentials;
    await this.options.store.write(credentials);
    return credentials;
  }
}
