import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { JWTVerifyGetKey } from 'jose';
import {
  AGENT_NAME_HINT,
  AUTHORIZATION_SCOPES,
  CHATGPT_SUBSCRIPTION_ENDPOINTS,
  REGISTRATION_CLIENT_ID,
} from './chatgpt-subscription.constants';
import type { ChatgptSubscriptionEndpoints } from './chatgpt-subscription.constants';
import { AiProviderAuthorizationFailedError } from '../errors/ai-providers.errors';

const REQUEST_TIMEOUT_MS = 15_000;
const REVOKE_ATTEMPTS = 3;

/** Refresh failures that mean the grant is gone and the person has to sign in again. */
const TERMINAL_REFRESH_ERRORS = new Set([
  'invalid_grant',
  'invalid_refresh_token',
  'token_expired',
  'refresh_token_expired',
  'refresh_token_invalidated',
  'refresh_token_reused',
]);

export type ChatgptTokenSet = {
  accessToken: string;
  refreshToken: string;
  /** Absent on a refresh that does not reissue it. */
  idToken: string | null;
  /** Space-separated scopes the person granted, or null when the answer did not say. */
  scope: string | null;
  expiresInSeconds: number;
};

export type VerifiedChatgptIdentity = {
  issuer: string;
  subject: string;
  email: string | null;
};

type Discovery = {
  issuer: string;
  jwksUri: string;
  revocationEndpoint: string | null;
};

type TokenResponseBody = {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  scope?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

/** The token endpoint answered with an OAuth error. */
export class ChatgptTokenEndpointError extends Error {
  constructor(
    readonly oauthError: string,
    readonly status: number,
    description: string | null,
  ) {
    super(description ? `${oauthError}: ${description}` : oauthError);
    this.name = 'ChatgptTokenEndpointError';
  }

  /** True when the stored grant can never work again. */
  get isTerminal(): boolean {
    return TERMINAL_REFRESH_ERRORS.has(this.oauthError);
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Talks to OpenAI's authorization server as a public OAuth client. Holds no
 * state about people; ChatgptConnectionsService owns that.
 */
@Injectable()
export class ChatgptOAuthClient {
  private readonly logger = new Logger(ChatgptOAuthClient.name);
  private discovery: Promise<Discovery> | null = null;
  private jwks: { uri: string; keys: JWTVerifyGetKey } | null = null;

  constructor(
    @Inject(CHATGPT_SUBSCRIPTION_ENDPOINTS)
    private readonly endpoints: ChatgptSubscriptionEndpoints,
  ) {}

  buildAuthorizationUrl(input: {
    /** Null for a first sign-in, which registers through the shared client. */
    issuedClientId: string | null;
    redirectUri: string;
    state: string;
    nonce: string;
    codeVerifier: string;
    hostId: string;
    /** Earlier ID token and email, so OpenAI can offer the same account again. */
    idTokenHint?: string | null;
    loginHint?: string | null;
  }): string {
    const url = new URL(this.endpoints.authorizeUrl);
    const params = url.searchParams;
    params.set('response_type', 'code');
    params.set('client_id', input.issuedClientId ?? REGISTRATION_CLIENT_ID);
    params.set('redirect_uri', input.redirectUri);
    params.set('scope', AUTHORIZATION_SCOPES);
    params.set('resource', this.endpoints.apiBaseUrl);
    params.set('state', input.state);
    params.set('nonce', input.nonce);
    params.set('code_challenge_method', 'S256');
    params.set('code_challenge', pkceChallenge(input.codeVerifier));
    params.set('ext_agent_host_id', input.hostId);
    if (!input.issuedClientId) {
      params.set('agent_name_hint', AGENT_NAME_HINT);
    } else {
      if (input.idTokenHint) {
        params.set('id_token_hint', input.idTokenHint);
      }
      if (input.loginHint) {
        params.set('login_hint', input.loginHint);
      }
    }
    return url.toString();
  }

  exchangeCode(input: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ChatgptTokenSet> {
    return this.requestTokens({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      resource: this.endpoints.apiBaseUrl,
    });
  }

  /** The answer carries a new refresh token; the one sent stops working. */
  refresh(input: {
    clientId: string;
    refreshToken: string;
  }): Promise<ChatgptTokenSet> {
    return this.requestTokens({
      grant_type: 'refresh_token',
      client_id: input.clientId,
      refresh_token: input.refreshToken,
      resource: this.endpoints.apiBaseUrl,
    });
  }

  /**
   * Checks the ID token's signature, issuer, audience, expiry and nonce, and
   * returns the account it names.
   */
  async verifyIdToken(input: {
    idToken: string;
    clientId: string;
    nonce: string;
  }): Promise<VerifiedChatgptIdentity> {
    const discovery = await this.getDiscovery();
    // Loaded here, not at the top: jose is an ES module, and a static import would be pulled
    // into every unit test that reaches this file through the providers service.
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    if (!this.jwks || this.jwks.uri !== discovery.jwksUri) {
      this.jwks = {
        uri: discovery.jwksUri,
        keys: createRemoteJWKSet(new URL(discovery.jwksUri)),
      };
    }

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(input.idToken, this.jwks.keys, {
        issuer: discovery.issuer,
        audience: input.clientId,
      }));
    } catch (error) {
      throw new AiProviderAuthorizationFailedError(
        'OpenAI returned an identity that could not be verified. Nothing was connected.',
        { reason: error instanceof Error ? error.message : String(error) },
      );
    }

    if (
      payload.nonce !== input.nonce ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw new AiProviderAuthorizationFailedError(
        'OpenAI returned an identity that does not belong to this sign-in. Nothing was connected.',
      );
    }

    return {
      issuer: discovery.issuer,
      subject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  }

  /**
   * Revokes a refresh token. OpenAI answers 200 for a token that was already
   * invalid, so only a network or server failure counts as not revoked.
   */
  async revoke(input: {
    clientId: string;
    refreshToken: string;
  }): Promise<boolean> {
    let endpoint: string | null;
    try {
      endpoint = (await this.getDiscovery()).revocationEndpoint;
    } catch (error) {
      this.logger.warn({
        message: 'Could not find the revocation endpoint',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    if (!endpoint) {
      return false;
    }

    for (let attempt = 0; attempt < REVOKE_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: input.refreshToken,
            token_type_hint: 'refresh_token',
            client_id: input.clientId,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) {
          return true;
        }
        if (response.status < 500) {
          this.logger.warn({
            message: 'Token revocation was refused',
            status: response.status,
          });
          return false;
        }
      } catch (error) {
        this.logger.warn({
          message: 'Token revocation request failed',
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return false;
  }

  private async requestTokens(
    form: Record<string, string>,
  ): Promise<ChatgptTokenSet> {
    const response = await fetch(this.endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as TokenResponseBody;

    if (!response.ok) {
      throw new ChatgptTokenEndpointError(
        typeof body.error === 'string' ? body.error : `http_${response.status}`,
        response.status,
        typeof body.error_description === 'string'
          ? body.error_description
          : null,
      );
    }

    if (
      typeof body.access_token !== 'string' ||
      typeof body.refresh_token !== 'string'
    ) {
      throw new ChatgptTokenEndpointError(
        'incomplete_token_response',
        response.status,
        null,
      );
    }

    const expiresIn = Number(body.expires_in);
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      idToken: typeof body.id_token === 'string' ? body.id_token : null,
      scope: typeof body.scope === 'string' ? body.scope : null,
      // Access tokens last an hour; assume that when the answer does not say.
      expiresInSeconds:
        Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
    };
  }

  private getDiscovery(): Promise<Discovery> {
    if (!this.discovery) {
      this.discovery = this.fetchDiscovery().catch((error) => {
        // A failed lookup is not remembered.
        this.discovery = null;
        throw error;
      });
    }
    return this.discovery;
  }

  private async fetchDiscovery(): Promise<Discovery> {
    const response = await fetch(this.endpoints.discoveryUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`OpenAI discovery answered ${response.status}`);
    }
    const body = (await response.json()) as {
      issuer?: unknown;
      jwks_uri?: unknown;
      revocation_endpoint?: unknown;
    };
    if (typeof body.issuer !== 'string' || typeof body.jwks_uri !== 'string') {
      throw new Error(
        'OpenAI discovery document is missing the issuer or signing keys',
      );
    }
    return {
      issuer: body.issuer,
      jwksUri: body.jwks_uri,
      revocationEndpoint:
        typeof body.revocation_endpoint === 'string'
          ? body.revocation_endpoint
          : null,
    };
  }
}
