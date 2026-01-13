// Guards
export { AccessTokenGuard } from './guards/access-token.guard';

// Validation
export { AccessTokenValidationService } from './validation/access-token-validation.service';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { Public } from './decorators/public.decorator';

// Re-export types from auth-core for convenience
export type { AuthContext, UserContext, AccessTokenClaims } from 'src/auth-core';
