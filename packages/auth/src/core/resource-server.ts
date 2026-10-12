import { toAudienceList, type AudiencePolicy } from './audience.js';
import {
  bearerTokenFrom,
  buildChallenge,
  parseCookies,
  type Challenge,
} from './challenge.js';
import {
  AuthError,
  InsufficientScopeError,
  InvalidAccessTokenError,
  MissingAccessTokenError,
  TokenExpiredError,
  InvalidTokenSignatureError,
  TokenRevokedError,
} from './errors.js';
import type { JwksSource } from './keys.js';
import type {
  ProtectedResource,
  ResourceRegistry,
  RevocationChecker,
} from './ports.js';
import { hasScopes, parseScope, type RequiredScopes } from './scopes.js';
import { TokenVerifier } from './tokens.js';
import { silentLogger, type AuthContext, type Logger } from './types.js';

export type ResourceServerOptions = {
  /** Which audiences this server accepts */
  audience: AudiencePolicy;
  /**
   * Public base URL of this server, without a trailing slash. Request URLs
   * are built from it, so a proxy in front does not change what is checked.
   */
  baseUrl?: string;
  /** Also accept the access token from this cookie. Off by default. */
  cookieName?: string;
  realm?: string;
  logger?: Logger;
} & (
  | { verifier: TokenVerifier }
  | { issuer: string; jwks: JwksSource; revocation?: RevocationChecker }
);

export type RequestCredentials = {
  /** Value of the Authorization header */
  authorization?: unknown;
  /** Value of the Cookie header */
  cookie?: unknown;
};

/**
 * The verify side: turns a request's credentials into an `AuthContext`, or
 * throws an `AuthError`. Framework adapters are thin wrappers around this.
 */
export class ResourceServer {
  readonly verifier: TokenVerifier;
  private readonly logger: Logger;

  constructor(private readonly options: ResourceServerOptions) {
    this.verifier =
      'verifier' in options
        ? options.verifier
        : new TokenVerifier({
            issuer: options.issuer,
            jwks: options.jwks,
            revocation: options.revocation,
          });
    this.logger = options.logger ?? silentLogger;
  }

  /** Public URL of a request, from its path (query string is dropped) */
  requestUrl(path: string, fallbackOrigin = ''): string {
    const base = (this.options.baseUrl ?? fallbackOrigin).replace(/\/$/, '');
    return `${base}${path.split('?')[0]}`;
  }

  /** The access token a request carries, or null */
  extractToken(credentials: RequestCredentials): string | null {
    const fromHeader = bearerTokenFrom(credentials.authorization);
    if (fromHeader || !this.options.cookieName) {
      return fromHeader;
    }
    return parseCookies(credentials.cookie)[this.options.cookieName] || null;
  }

  /** Authenticates a request from its headers */
  async authenticate<Extra extends object = Record<string, unknown>>(
    credentials: RequestCredentials,
    requestUrl: string,
  ): Promise<AuthContext<Extra>> {
    const token = this.extractToken(credentials);
    if (!token) {
      throw new MissingAccessTokenError();
    }
    return this.authenticateToken<Extra>(token, requestUrl);
  }

  /** Verifies a token and checks it was minted for `requestUrl` */
  async authenticateToken<Extra extends object = Record<string, unknown>>(
    token: string,
    requestUrl: string,
  ): Promise<AuthContext<Extra>> {
    let claims;
    try {
      claims = await this.verifier.verify<Extra>(token);
    } catch (error) {
      // The token itself is never logged
      if (error instanceof TokenExpiredError) {
        throw new InvalidAccessTokenError('Token expired');
      }
      if (error instanceof InvalidTokenSignatureError) {
        throw new InvalidAccessTokenError('Invalid signature');
      }
      if (error instanceof TokenRevokedError) {
        throw new InvalidAccessTokenError('Token revoked');
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Access token validation failed: ${reason}`);
      throw new InvalidAccessTokenError(`Invalid access token: ${reason}`);
    }

    if (!this.options.audience.accepts(toAudienceList(claims.aud), requestUrl)) {
      this.logger.warn('Access token audience does not match this resource');
      throw new InvalidAccessTokenError('Token was not issued for this resource');
    }

    return {
      token,
      claims,
      scopes: parseScope(claims.scope),
      subject: claims.sub,
    };
  }

  /** Throws `InsufficientScopeError` unless the context has the scopes */
  requireScopes(
    auth: Pick<AuthContext, 'scopes'> | undefined,
    required: RequiredScopes,
  ): void {
    assertScopes(auth, required);
  }

  /** The Bearer challenge that answers `error`, or null if it is not ours */
  challenge(error: unknown, resourceMetadataUrl?: string): Challenge | null {
    if (!(error instanceof AuthError)) {
      return null;
    }
    return buildChallenge(error, {
      realm: this.options.realm,
      resourceMetadataUrl,
    });
  }
}

export function createResourceServer(
  options: ResourceServerOptions,
): ResourceServer {
  return new ResourceServer(options);
}

export function assertScopes(
  auth: Pick<AuthContext, 'scopes'> | undefined,
  required: RequiredScopes,
): void {
  if (required.scopes.length === 0) {
    return;
  }
  // No context means the authentication step did not run: fail closed
  if (!auth) {
    throw new InvalidAccessTokenError('Missing auth context');
  }
  if (!hasScopes(auth.scopes ?? [], required.scopes, required.mode)) {
    throw new InsufficientScopeError(required.scopes, required.mode);
  }
}

// ---------------------------------------------------------------- metadata

/** RFC 9728 protected resource metadata */
export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name: string;
};

export function buildProtectedResourceMetadata(
  resource: ProtectedResource,
  authorizationServers: string[],
): ProtectedResourceMetadata {
  return {
    resource: resource.resourceUrl,
    authorization_servers: authorizationServers,
    scopes_supported: resource.scopes.map((scope) => scope.id),
    bearer_methods_supported: ['header'],
    resource_name: resource.name,
  };
}

export const PROTECTED_RESOURCE_METADATA_PATH =
  '/.well-known/oauth-protected-resource';

/** URL of the protected resource metadata for a resource URL (RFC 9728 section 3.1) */
export function resourceMetadataUrlFor(resourceUrl: string): string {
  const url = new URL(resourceUrl);
  const path = url.pathname === '/' ? '' : url.pathname;
  return `${url.origin}${PROTECTED_RESOURCE_METADATA_PATH}${path}`;
}

const pathKey = (path: string) => path.replace(/\/$/, '') || '/';

/** The resource served at a URL path, from a registry or a plain list */
export async function findResourceByPath(
  resources: ResourceRegistry | readonly ProtectedResource[],
  path: string,
): Promise<ProtectedResource | null> {
  if (!Array.isArray(resources)) {
    return (resources as ResourceRegistry).findByPath(path);
  }
  return (
    (resources as readonly ProtectedResource[]).find(
      (resource) => pathKey(new URL(resource.resourceUrl).pathname) === pathKey(path),
    ) ?? null
  );
}
