import { AuthError, AuthErrorCodes } from '@taico/auth';

// Verification failures themselves (expired, bad signature, revoked, ...)
// are the `@taico/auth` token errors.
export {
  InvalidTokenSignatureError,
  TokenExpiredError,
  TokenRevokedError,
  TokenValidationError,
} from '@taico/auth';

/** Thrown when a token that is not a web session token is used as a session cookie */
export class NotSessionTokenError extends AuthError {
  constructor() {
    super(
      'Token is not a web session token.',
      AuthErrorCodes.INVALID_ACCESS_TOKEN,
    );
  }
}
