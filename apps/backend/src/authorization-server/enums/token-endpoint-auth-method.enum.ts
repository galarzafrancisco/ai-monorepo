/**
 * OAuth 2.0 token endpoint authentication methods.
 * Defines how clients authenticate when requesting tokens.
 */
export enum TokenEndpointAuthMethod {
  NONE = 'none',
  CLIENT_SECRET_BASIC = 'client_secret_basic',
  /**
   * The client signs a short-lived JWT with its private key (RFC 7523).
   * Only for metadata document clients, which publish the public keys.
   */
  PRIVATE_KEY_JWT = 'private_key_jwt',
}
