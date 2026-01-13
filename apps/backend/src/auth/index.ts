// Barrel export for auth module
export * from './guards/access-token.guard';
export * from './decorators/current-user.decorator';
export * from './decorators/public.decorator';
export * from './validation/access-token-validation.service';

// Re-export commonly used types from auth-core for convenience
export type { AuthContext, UserContext, AccessTokenClaims } from 'src/auth-core';
