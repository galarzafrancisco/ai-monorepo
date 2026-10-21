import { Injectable } from '@nestjs/common';
import { AccessTokenClaims } from '../../core/types/access-token-claims.type';
import { TokenVerifierService } from '../../crypto/token-verifier.service';

/**
 * Validates an access token outside the guards (socket handshakes).
 * Checks signature, issuer, expiry and revocation; the caller checks the
 * audience and scopes.
 */
@Injectable()
export class AccessTokenValidationService {
  constructor(private readonly tokenVerifierService: TokenVerifierService) {}

  validateAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.tokenVerifierService.verifyAndDecode(token);
  }
}
