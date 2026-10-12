import { ErrorCodes } from '@taico/errors';

export const AccessTokenErrorCodes = {
  MISSING_ACCESS_TOKEN: ErrorCodes.MISSING_ACCESS_TOKEN,
  INVALID_ACCESS_TOKEN: ErrorCodes.INVALID_ACCESS_TOKEN,
  INSUFFICIENT_SCOPE: ErrorCodes.INSUFFICIENT_SCOPE,
};

// The errors the guards throw. Their `code`s are the ones above, so the
// global exception filter maps them like any other domain error.
export {
  InsufficientScopeError,
  InvalidAccessTokenError,
  MissingAccessTokenError,
} from '@taico/auth';
