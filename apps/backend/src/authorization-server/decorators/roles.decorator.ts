import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard';

/**
 * Method decorator that sets role requirements for a route.
 * Used in conjunction with RolesGuard to enforce role-based access control.
 *
 * @param roles - Array of role scopes required to access the route
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('monolith:admin')
 * @Get('admin-only')
 * async adminRoute(@CurrentUser() user: WebAuthJwtPayload) {
 *   // Only users with 'monolith:admin' scope can access this
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
