/**
 * OAuth 2.0 grant types supported by the authorization server.
 * Defines the methods a client can use to obtain access tokens.
 */
export enum GrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  REFRESH_TOKEN = 'refresh_token',
}
