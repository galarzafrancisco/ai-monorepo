import { TokenType } from '../../enums/token-type.enum';
import { TokenTypeHint } from '../../enums/token-type-hint.enum';
import { AccessTokenClaims } from '../../../auth/core/types/access-token-claims.type';

/**
 * Service layer types for token operations - transport agnostic
 * These types have no HTTP-specific decorators or concerns
 */

/**
 * Input for token introspection operation
 */
export type IntrospectTokenInput = {
  token: string;
  token_type_hint?: TokenTypeHint;
  client_id?: string;
  client_secret?: string;
};

/**
 * Result of token introspection operation
 * Discriminated union based on token validity
 */
export type IntrospectTokenResult =
  | {
      active: false;
    }
  | {
      active: true;
      token_type: TokenType;
      client_id: string;
      sub: AccessTokenClaims['sub'];
      aud: AccessTokenClaims['aud'];
      iss: AccessTokenClaims['iss'];
      jti: AccessTokenClaims['jti'];
      exp: AccessTokenClaims['exp'];
      iat: AccessTokenClaims['iat'];
      scope?: string;
      mcp_server_identifier?: AccessTokenClaims['mcp_server_identifier'];
      resource: AccessTokenClaims['resource'];
      version: AccessTokenClaims['version'];
    };
