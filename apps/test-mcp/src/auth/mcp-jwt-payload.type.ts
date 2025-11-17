/**
 * Shape of the JWT payload we issue for MCP access tokens.
 * This is a copy from the authorization server to avoid circular dependencies.
 */
export interface McpJwtPayload {
  /**
   * Issuer - authorization server identifier (URL)
   */
  iss: string;

  /**
   * Subject - represents the resource owner or actor on whose behalf the client is operating
   */
  sub: string;

  /**
   * Audience - the resource server(s) that should accept this token
   */
  aud: string | string[];

  /**
   * Expiration time (seconds since Unix epoch)
   */
  exp: number;

  /**
   * Issued-at time (seconds since Unix epoch)
   */
  iat: number;

  /**
   * Unique identifier for the token to support replay protection
   */
  jti: string;

  /**
   * Client identifier that was issued during registration
   */
  client_id: string;

  /**
   * Scopes granted to the client, stored as individual scope strings
   */
  scope: string[];

  /**
   * MCP server identifier (providedId) that the token is scoped to
   */
  server_identifier: string;

  /**
   * Resource URL associated with the authorization request
   */
  resource: string;

  /**
   * Version of the MCP server contract that this token was minted for
   */
  version: string;
}
