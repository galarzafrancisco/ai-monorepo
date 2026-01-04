import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenService } from '../token.service';
import { COOKIE_KEYS } from '../constants/cookie-keys.constant';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN];

    if (!token) {
      throw new UnauthorizedException('No access token provided');
    }

    try {
      // Validate token and get payload
      const payload = await this.tokenService.validateWebToken(token);

      // Attach user payload to request for use in route handlers
      (request as any).user = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
