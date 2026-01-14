import { Injectable } from "@nestjs/common";
import { AccessTokenClaims } from "../../core/types/access-token-claims.type";
import { TokenVerifierService } from "../../crypto/token-verifier.service";

/**
 * Placeholder interface/service.
 * Implement with JWKS, iss/aud checks, exp, etc.
 */
@Injectable()
export class AccessTokenValidationService {
  constructor(
      private readonly tokenVerifierService: TokenVerifierService
  ) {}
  
  async validateAccessToken(token: string): Promise<AccessTokenClaims> {
    // Decode token (verifies signature, expiry and issuer)
    const jwt = this.tokenVerifierService.verifyAndDecode(token);
    // If any additional validation, do it here.
    return jwt;
  }
}
