import { AccessTokenClaims } from '../../core/types/access-token-claims.type';
import { DEFAULT_WORKSPACE_ID } from '../../../workspaces/workspaces.constants';
import { AuthContext } from './auth-context.types';

/**
 * The workspace a token works in. Tokens minted before workspaces existed
 * have no `workspace_id` claim; they work in the default workspace until
 * they expire.
 */
export function workspaceIdFromClaims(claims: AccessTokenClaims): string {
  return claims.workspace_id || DEFAULT_WORKSPACE_ID;
}

/**
 * Builds the auth context every transport (HTTP, WebSocket, MCP) attaches
 * after validating a token, so they all agree on the actor and workspace.
 */
export function createAuthContext(
  token: string,
  claims: AccessTokenClaims,
): AuthContext {
  return {
    token,
    claims,
    scopes: claims.scope,
    subject: claims.sub,
    workspaceId: workspaceIdFromClaims(claims),
  };
}
