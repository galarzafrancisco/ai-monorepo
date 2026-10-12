import { createHash, randomBytes } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

/**
 * A small MCP client for tests. It follows the MCP authorization spec the way
 * a real client does, over real HTTP, with nothing hard-coded about Taico:
 *
 *   1. call the MCP server without a token and read the 401
 *   2. fetch the protected resource metadata it points to
 *   3. discover the authorization server metadata (RFC 8414, then the two
 *      OpenID Connect locations) and check the issuer
 *   4. get a client_id: a Client ID Metadata Document URL when the client has
 *      one and the server supports it, dynamic registration otherwise
 *   5. authorization code + PKCE, then the token request
 *
 * The one thing it cannot do is be the user, so the test supplies `approve`.
 */

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  client_id_metadata_document_supported?: boolean;
};

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type PendingAuthorization = {
  authorizationUrl: URL;
  codeVerifier: string;
  state: string;
};

export type FakeMcpClientOptions = {
  /** Where the client receives the authorization response */
  redirectUri: string;
  /** Set when the client hosts a Client ID Metadata Document */
  clientMetadataUrl?: string;
  /** Plays the user: opens the authorization URL and returns the URL the browser is sent back to */
  approve: (authorizationUrl: URL) => Promise<URL>;
  /**
   * Maps a public URL to where it is reachable from the test. Stands in for
   * the reverse proxy in front of a deployed Taico.
   */
  route?: (url: string) => string;
};

export class FakeMcpClient {
  clientId?: string;
  registrationMethod?: 'metadata_document' | 'dynamic_registration';
  resource?: string;
  /** Scopes the MCP server lists in its protected resource metadata */
  scopesSupported?: string[];
  metadata?: AuthorizationServerMetadata;
  tokens?: TokenSet;
  /** URL the authorization server metadata was found at */
  metadataUrl?: string;

  constructor(private readonly options: FakeMcpClientOptions) {}

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(this.options.route?.(url) ?? url, {
      redirect: 'manual',
      ...init,
    });
  }

  /** Steps 1 to 3: from an MCP server URL to validated authorization server metadata */
  async discover(mcpUrl: string): Promise<AuthorizationServerMetadata> {
    const unauthenticated = await this.fetch(mcpUrl, { method: 'POST' });
    if (unauthenticated.status !== 401) {
      throw new Error(
        `expected 401 from ${mcpUrl}, got ${unauthenticated.status}`,
      );
    }
    const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(
      unauthenticated.headers.get('www-authenticate') ?? '',
    )?.[1];
    if (!resourceMetadataUrl) {
      throw new Error('401 without a resource_metadata URL');
    }

    const resourceMetadata = await (
      await this.fetch(resourceMetadataUrl)
    ).json();
    if (resourceMetadata.resource !== mcpUrl) {
      throw new Error(`resource metadata is for ${resourceMetadata.resource}`);
    }
    this.resource = mcpUrl;
    this.scopesSupported = resourceMetadata.scopes_supported;

    const issuer: string = resourceMetadata.authorization_servers[0];
    const { origin, pathname } = new URL(issuer);
    const path = pathname === '/' ? '' : pathname;
    const candidates = [
      `${origin}/.well-known/oauth-authorization-server${path}`,
      `${origin}/.well-known/openid-configuration${path}`,
      `${origin}${path}/.well-known/openid-configuration`,
    ];
    for (const candidate of candidates) {
      const response = await this.fetch(candidate);
      if (!response.ok) {
        continue;
      }
      const metadata: AuthorizationServerMetadata = await response.json();
      if (metadata.issuer !== issuer) {
        throw new Error(`issuer mismatch: ${metadata.issuer} != ${issuer}`);
      }
      if (!metadata.code_challenge_methods_supported?.includes('S256')) {
        throw new Error('authorization server does not support PKCE S256');
      }
      this.metadata = metadata;
      this.metadataUrl = candidate;
      return metadata;
    }
    throw new Error(`no authorization server metadata found for ${issuer}`);
  }

  /** Step 4: MCP's priority order, metadata document first, registration as the fallback */
  async obtainClientId(): Promise<string> {
    const metadata = this.requireMetadata();
    if (
      this.options.clientMetadataUrl &&
      metadata.client_id_metadata_document_supported
    ) {
      this.clientId = this.options.clientMetadataUrl;
      this.registrationMethod = 'metadata_document';
      return this.clientId;
    }
    if (!metadata.registration_endpoint) {
      throw new Error('no way to obtain a client_id');
    }

    const response = await this.fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Fake MCP client',
        redirect_uris: [this.options.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'native',
      }),
    });
    if (response.status !== 201) {
      throw new Error(
        `registration failed: ${response.status} ${await response.text()}`,
      );
    }
    this.clientId = (await response.json()).client_id;
    this.registrationMethod = 'dynamic_registration';
    return this.clientId!;
  }

  /**
   * Builds the authorization request the user's browser is sent to.
   * Without an explicit scope it asks for what the MCP server lists, as the
   * MCP scope selection strategy says.
   */
  startAuthorization(
    scope = this.scopesSupported?.join(' '),
  ): PendingAuthorization {
    const metadata = this.requireMetadata();
    const codeVerifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('hex');

    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.options.redirectUri,
      state,
      code_challenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
      code_challenge_method: 'S256',
      resource: this.resource!,
      ...(scope ? { scope } : {}),
    }).toString();

    return { authorizationUrl, codeVerifier, state };
  }

  /** Handles the redirect back from the authorization server and redeems the code */
  async finishAuthorization(
    pending: PendingAuthorization,
    callbackUrl: URL,
  ): Promise<TokenSet> {
    const error = callbackUrl.searchParams.get('error');
    if (error) {
      throw new Error(
        `authorization failed: ${error} ${callbackUrl.searchParams.get('error_description')}`,
      );
    }
    if (callbackUrl.searchParams.get('state') !== pending.state) {
      throw new Error('state mismatch in the authorization response');
    }
    return this.requestToken({
      grant_type: 'authorization_code',
      code: callbackUrl.searchParams.get('code')!,
      redirect_uri: this.options.redirectUri,
      code_verifier: pending.codeVerifier,
    });
  }

  /** The whole flow, from an MCP server URL to tokens */
  async connect(mcpUrl: string, scope?: string): Promise<TokenSet> {
    await this.discover(mcpUrl);
    if (!this.clientId) {
      await this.obtainClientId();
    }
    return this.authorize(scope);
  }

  /** Authorization only: what a client does when its tokens can no longer be refreshed */
  async authorize(scope?: string): Promise<TokenSet> {
    const pending = this.startAuthorization(scope);
    const callbackUrl = await this.options.approve(pending.authorizationUrl);
    return this.finishAuthorization(pending, callbackUrl);
  }

  async refresh(): Promise<TokenSet> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: this.tokens!.refresh_token,
    });
  }

  async requestToken(parameters: Record<string, string>): Promise<TokenSet> {
    const response = await this.fetch(this.requireMetadata().token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        resource: this.resource!,
        ...parameters,
      }).toString(),
    });
    if (!response.ok) {
      throw new Error(
        `token request failed: ${response.status} ${await response.text()}`,
      );
    }
    this.tokens = await response.json();
    return this.tokens!;
  }

  /** An MCP initialize request with the current access token */
  callMcp(accessToken = this.tokens?.access_token): Promise<Response> {
    return this.fetch(this.resource!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'fake-mcp-client', version: '0.0.0' },
        },
      }),
    });
  }

  private requireMetadata(): AuthorizationServerMetadata {
    if (!this.metadata) {
      throw new Error('discover() has not run');
    }
    return this.metadata;
  }
}

/**
 * The web server a client hosts its Client ID Metadata Documents on.
 * Each document gets its own path, and so its own client_id.
 */
export class ClientMetadataHost {
  /** Number of times each path was requested */
  readonly requests = new Map<string, number>();
  private readonly responses = new Map<
    string,
    { status: number; headers: Record<string, string>; body: string }
  >();
  private server!: Server;
  origin!: string;

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const path = request.url ?? '/';
      this.requests.set(path, (this.requests.get(path) ?? 0) + 1);
      const configured = this.responses.get(path);
      if (!configured) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(configured.status, configured.headers)
        .end(configured.body);
    });
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
    this.origin = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server.close(resolve));
  }

  /**
   * Publishes a metadata document and returns its URL, which is the client_id.
   * `client_id` is filled in unless the document sets it.
   */
  publish(
    path: string,
    document: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): string {
    const clientId = `${this.origin}${path}`;
    this.respond(path, {
      body: JSON.stringify({ client_id: clientId, ...document }),
      headers,
    });
    return clientId;
  }

  /** Serves an arbitrary response and returns the URL */
  respond(
    path: string,
    response: {
      status?: number;
      headers?: Record<string, string>;
      body: string;
    },
  ): string {
    this.responses.set(path, {
      status: response.status ?? 200,
      headers: { 'content-type': 'application/json', ...response.headers },
      body: response.body,
    });
    return `${this.origin}${path}`;
  }

  requestCount(clientId: string): number {
    return this.requests.get(new URL(clientId).pathname) ?? 0;
  }
}
