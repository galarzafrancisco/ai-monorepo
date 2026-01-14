/*
# Purpose
Authenticate any incoming HTTP request using one canonical JWT access token.
- Token transport (for now): Authorization: Bearer
- Validation: shared JwtValidationService (JWKS, iss/aud/exp, etc.)
- Output: attach a typed AuthContext to the request for downstream use
- Errors: throw UnauthorizedException (the global exception filter will add WWW-Authenticate everywhere)
*/

import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { AccessTokenValidationService } from "../validation/access-token-validation.service";
import { InvalidAccessTokenError, MissingAccessTokenError } from "../errors/access-token.errors";
import type { AuthContext } from "../context/auth-context.types";
import { extractBearerToken } from "../extractors/access-token.extractor";
import { extractTokenFromCookie } from "../extractors/cookie.extractor";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { InvalidTokenSignaturedError, TokenExpiredError } from "../../core/errors/jwt.errors";
import { AccessTokenClaims } from "../../core/types/access-token-claims.type";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly logger = new Logger(AccessTokenGuard.name);

  constructor(
    private readonly validator: AccessTokenValidationService,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // 1) Extract token
    const token = extractBearerToken(req) || extractTokenFromCookie(req);
    if (!token) {
      throw new MissingAccessTokenError();
    }

    // 2) Validate token
    let claims: AccessTokenClaims;
    try {
      claims = await this.validator.validateAccessToken(token);
    } catch (error) {
      // Don't log the token.
      if (error instanceof TokenExpiredError) {
        throw new InvalidAccessTokenError('Token expired');
      } else if (error instanceof InvalidTokenSignaturedError) {
        throw new InvalidAccessTokenError('Invalid signature');
      }
      this.logger.warn(`Access token validation failed: ${this.safeErr(error)}`);
      throw new InvalidAccessTokenError(`Invalid or expired access token: ${error}`);
    }

    // 3) Attach auth context
    const authContext: AuthContext = {
      token,
      claims,
      scopes: claims.scope,
      subject: claims.sub,
    }

    res.locals.auth = authContext;

    return true;
  }

  private safeErr(err: unknown): string {
    if (err instanceof Error) return err.message || err.name;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
