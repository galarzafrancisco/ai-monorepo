import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { AuthContext, type UserContext } from '../context/auth-context.types';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 * The user object is set by AccessTokenGuard after validating the access token.
 *
 * @example
 * ```typescript
 * @UseGuards(AccessTokenGuard)
 * @Get('profile')
 * async getProfile(@CurrentUser() user: UserContext) {
 *   return { userId: user.sub, email: user.email };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): UserContext => {
    const res = context.switchToHttp().getResponse<Response>();
    const authCtx = res.locals.auth as AuthContext;
    return {
      email: authCtx.claims.email || 'email not found',
      id: authCtx.claims.sub,
      displayName: authCtx.claims.displayName || authCtx.claims.sub,
    };
  },
);
