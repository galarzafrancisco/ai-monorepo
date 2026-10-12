import { randomBytes } from 'node:crypto';
import { decodeProtectedHeader, errors, jwtVerify, SignJWT, type JWK } from 'jose';
import {
  InvalidTokenSignatureError,
  TokenExpiredError,
  TokenRevokedError,
  TokenValidationError,
} from './errors.js';
import { KeyManager, SIGNING_ALGORITHM, type JwksSource } from './keys.js';
import type { RevocationChecker } from './ports.js';
import { formatScope } from './scopes.js';
import {
  systemClock,
  type AccessTokenClaims,
  type Clock,
} from './types.js';

export type TokenVerifierOptions = {
  /** The `iss` a token must carry */
  issuer: string;
  jwks: JwksSource;
  algorithms?: string[];
  clockToleranceSeconds?: number;
  /** When set, a token whose `jti` was revoked fails verification */
  revocation?: RevocationChecker;
};

/**
 * Verifies access tokens: signature, issuer, expiry and revocation.
 * It does not look at the audience or scopes; `ResourceServer` does.
 */
export class TokenVerifier {
  constructor(private readonly options: TokenVerifierOptions) {}

  get issuer(): string {
    return this.options.issuer;
  }

  async verify<Extra extends object = Record<string, unknown>>(
    token: string,
  ): Promise<AccessTokenClaims<Extra>> {
    let claims: AccessTokenClaims<Extra>;
    try {
      const { payload } = await jwtVerify(token, await this.keyFor(token), {
        issuer: this.options.issuer,
        algorithms: this.options.algorithms ?? [SIGNING_ALGORITHM],
        clockTolerance: this.options.clockToleranceSeconds ?? 0,
        requiredClaims: ['exp', 'sub'],
      });
      claims = payload as unknown as AccessTokenClaims<Extra>;
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new TokenExpiredError();
      }
      if (error instanceof errors.JWSSignatureVerificationFailed) {
        throw new InvalidTokenSignatureError();
      }
      throw new TokenValidationError(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    if (
      this.options.revocation &&
      typeof claims.jti === 'string' &&
      (await this.options.revocation.isRevoked(claims.jti))
    ) {
      throw new TokenRevokedError();
    }
    return claims;
  }

  /** Picks the key a token names. Asks for fresh keys once if it is unknown. */
  private async keyFor(token: string): Promise<JWK> {
    const { kid } = decodeProtectedHeader(token);
    if (typeof kid !== 'string') {
      throw new Error('Token does not name a key');
    }
    const find = (keys: JWK[]) => keys.find((key) => key.kid === kid);
    const key =
      find(await this.options.jwks.getKeys()) ??
      find(await this.options.jwks.getKeys({ forceRefresh: true }));
    if (!key) {
      throw new Error('Key not found');
    }
    return key;
  }
}

export type IssueTokenInput = {
  subject: string;
  audience: string | string[];
  scopes: readonly string[];
  clientId: string;
  ttlSeconds: number;
  /** Extra claims. They cannot replace the standard ones. */
  claims?: Record<string, unknown>;
};

export type SignedToken = {
  token: string;
  jti: string;
  expiresAt: Date;
};

/** The one place tokens are signed */
export class TokenSigner {
  constructor(
    private readonly keys: KeyManager,
    private readonly issuer: string,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Builds the standard claims around `input` and signs them */
  async issue(input: IssueTokenInput): Promise<SignedToken> {
    const now = Math.floor(this.clock.now().getTime() / 1000);
    const exp = now + Math.max(1, Math.floor(input.ttlSeconds));
    const jti = randomBytes(16).toString('hex');
    const token = await this.sign({
      ...input.claims,
      iss: this.issuer,
      sub: input.subject,
      aud: input.audience,
      iat: now,
      exp,
      jti,
      client_id: input.clientId,
      scope: formatScope(input.scopes),
    });
    return { token, jti, expiresAt: new Date(exp * 1000) };
  }

  /** Signs claims exactly as given, with the active key */
  async sign(claims: Record<string, unknown>): Promise<string> {
    const key = await this.keys.getSigningKey();
    return new SignJWT(claims)
      .setProtectedHeader({ alg: key.algorithm, kid: key.kid, typ: 'JWT' })
      .sign(key.privateKey);
  }
}
