/**
 * Shape of the JWT payload we issue for web authentication access tokens.
 * This is the payload structure returned by TokenService.validateWebToken()
 * and attached to the request object by JwtAuthGuard.
 */
export interface WebAuthJwtPayload {
  /**
   * Issuer - authorization server identifier (URL)
   */
  iss: string;

  /**
   * Subject - user ID
   */
  sub: string;

  /**
   * User email address
   */
  email: string;

  /**
   * User display name
   */
  displayName: string;

  /**
   * Scopes granted to the user
   * Examples: ['monolith:user'], ['monolith:user', 'monolith:admin']
   */
  scope: string[];

  /**
   * Issued-at time (seconds since Unix epoch)
   */
  iat: number;

  /**
   * Expiration time (seconds since Unix epoch)
   */
  exp: number;

  /**
   * Unique identifier for the token to support replay protection
   */
  jti: string;

  /**
   * Token type - always 'access' for access tokens
   */
  type: 'access';
}
