/**
 * Token type hints defined by RFC 7662 for the introspection endpoint.
 * Helps the authorization server optimize token lookups.
 */
export enum TokenTypeHint {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
}
