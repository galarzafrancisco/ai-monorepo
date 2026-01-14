import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 * The user object is set by JwtAuthGuard after validating the access token.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AccessTokenClaims) {
 *   return { userId: user.sub, email: user.email };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AccessTokenClaims => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
