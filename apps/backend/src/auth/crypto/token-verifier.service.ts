import { Injectable, Logger } from '@nestjs/common';
import { TokenVerifier } from '@taico/auth';
import { getConfig } from 'src/config/env.config';
import { NotSessionTokenError } from '../core/errors/jwt.errors';
import { WEB_SESSION_AUDIENCE } from '../core/resource-audience';
import { AccessTokenClaims } from '../core/types/access-token-claims.type';
import { IssuedTokenRevocationService } from './issued-token-revocation.service';
import { JwksService } from './jwks.service';

@Injectable()
export class TokenVerifierService {
  private logger = new Logger(TokenVerifierService.name);

  /** The `@taico/auth` verifier, shared with the guards */
  readonly verifier: TokenVerifier;

  constructor(
    jwksService: JwksService,
    revocation: IssuedTokenRevocationService,
  ) {
    this.verifier = new TokenVerifier({
      issuer: getConfig().issuerUrl,
      jwks: { getKeys: (options) => jwksService.getPublicKeys(options) },
      revocation,
    });
  }

  /**
   * Verifies a token taken from the browser session cookie. Only tokens minted
   * for a web session are accepted, so a token issued to an MCP client or a
   * worker cannot be replayed as a logged-in user.
   */
  async verifySessionToken(token: string): Promise<AccessTokenClaims> {
    const claims = await this.verifyAndDecode(token);
    if (claims.aud !== WEB_SESSION_AUDIENCE) {
      this.logger.warn('Non-session token presented as a session cookie');
      throw new NotSessionTokenError();
    }
    return claims;
  }

  /**
   * Verifies signature, issuer, expiry and revocation, and decodes a JWT.
   * Does not check the audience: callers decide which audiences they accept.
   * Throws the `@taico/auth` token errors (`TokenExpiredError`, ...).
   */
  verifyAndDecode(token: string): Promise<AccessTokenClaims> {
    return this.verifier.verify<AccessTokenClaims>(token);
  }
}
