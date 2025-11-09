/**
 * OAuth 2.0 token types supported by the authorization server.
 * MCP clients only receive Bearer tokens today, but enum keeps the contract explicit.
 */
export enum TokenType {
  BEARER = 'Bearer',
}
