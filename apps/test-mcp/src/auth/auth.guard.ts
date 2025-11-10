import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthContext } from './auth.types';
import { SELF_URL } from 'src/config/self.config';
import { JwtValidationService } from './jwt-validation.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private logger = new Logger(AuthGuard.name);

  constructor(private readonly jwtValidationService: JwtValidationService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const authHeader = req.headers.authorization;

    // Check if token is present
    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.error(`Bearer resource_metadata=${SELF_URL}/.well-known/oauth-protected-resource`);
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata=${SELF_URL}/.well-known/oauth-protected-resource`
      );
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.slice('Bearer '.length);

    // Validate token using JWKS and decode payload
    try {
      const payload = await this.jwtValidationService.validateToken(token);
      this.logger.debug(`Token validated for subject: ${payload.sub}`);

      const auth: AuthContext = {
        token,
        payload,
      };
      res.locals.auth = auth;

      return true;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata=${SELF_URL}/.well-known/oauth-protected-resource error="invalid_token" error_description="The access token is invalid or has expired"`
      );
      throw error;
    }
  }
}
