import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwksService } from './jwks.service';
import { AccessTokenClaims } from '../core/types/access-token-claims.type';
import { errors, JWK, jwtVerify } from 'jose';
import { getConfig } from 'src/config/env.config';
import { WEB_SESSION_AUDIENCE } from '../core/resource-audience';
import {
  InvalidTokenSignaturedError,
  NotSessionTokenError,
  TokenExpiredError,
  TokenValidationError,
} from '../core/errors/jwt.errors';

@Injectable()
export class TokenVerifierService {
  private logger = new Logger(TokenVerifierService.name);

  constructor(private readonly jwksService: JwksService) {}

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
   * Verifies signature, issuer and expiry, and decodes a JWT.
   * Does not check the audience: callers decide which audiences they accept.
   */
  async verifyAndDecode(token: string): Promise<AccessTokenClaims> {
    try {
      // Get all valid public keys for verification
      const publicKeys = await this.jwksService.getPublicKeys();
      if (publicKeys.length === 0) {
        this.logger.error('No public keys available for token verification');
        throw new UnauthorizedException('Token verification failed');
      }

      const config = getConfig();
      const { payload } = await jwtVerify(token, getKeyFactory(publicKeys), {
        issuer: config.issuerUrl,
        algorithms: ['RS256'],
      });
      const claims = payload as unknown as AccessTokenClaims;

      // Additional claim checks can be added here if necessary
      return claims;
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        this.logger.debug('Token introspection failed: expired');
        throw new TokenExpiredError();
      } else if (error instanceof errors.JWSSignatureVerificationFailed) {
        this.logger.warn('Token introspection failed: bad signature');
        throw new InvalidTokenSignaturedError();
      } else {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Token introspection failed: ${errorMessage}`);
        throw new TokenValidationError(errorMessage);
      }
    }
  }
}

function getKeyFactory(publicKeys: JWK[]): (header: any) => Promise<JWK> {
  return async (header: any) => {
    const key = publicKeys.find((k) => k.kid === header.kid);
    if (!key) {
      throw new Error('Key not found');
    }
    return key as any;
  };
}
