import { Injectable } from "@nestjs/common";
import type { AccessTokenClaims } from "../context/auth-context.types";
import { TokenService } from "src/authorization-server/token.service";

/**
 * Placeholder interface/service.
 * Implement with JWKS, iss/aud checks, exp, etc.
 */
@Injectable()
export class AccessTokenValidationService {
  constructor(
      private readonly tokenService: TokenService
  ) {}
  
  async validateAccessToken(token: string): Promise<AccessTokenClaims> {
    // Decode token (verifies signature, expiry and issuer)
    const jwt = this.tokenService.decodeToken(token);
    // If any additional validation, do it here.
    return jwt;
  }
}
