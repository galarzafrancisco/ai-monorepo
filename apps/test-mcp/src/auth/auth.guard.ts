import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthContext } from './auth.types';
import { SELF_URL } from 'src/config/self.config';

@Injectable()
export class AuthGuard implements CanActivate {
  private logger = new Logger(AuthGuard.name);
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> {
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
    
    // Check if token is valid
    if (!this.validateToken(token)) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata=${SELF_URL}/.well-known/oauth-protected-resource error="invalid_token" error_description="The access token is invalid or has expired`
      );
      throw new UnauthorizedException("Token is invalid")
    }
    this.logger.debug(`Extracted token`);
    
    const auth: AuthContext = {
      token,
    }
    res.locals.auth = auth;

    return true;
  }

  /*
  Simulated
  */
  private validateToken(token: string): boolean {
    return true;
  }
}
