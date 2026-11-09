import { ErrorCodes } from '@taico/errors';

/**
 * Taico was asked to mint a token in a workspace the subject or the issuer is
 * not a member of. Not an OAuth grant failure.
 */
export class TokenActorNotInWorkspaceError extends Error {
  readonly code = ErrorCodes.TOKEN_ACTOR_NOT_IN_WORKSPACE;
  constructor(
    readonly actorId: string,
    readonly workspaceId: string,
  ) {
    super(`Actor ${actorId} is not a member of workspace ${workspaceId}`);
    this.name = TokenActorNotInWorkspaceError.name;
  }
}

/**
 * A token was asked to carry scopes its subject or its issuer is not
 * entitled to in its workspace (a member asking for `user:admin`, anyone
 * asking for `installation:admin`, ...). Refused rather than trimmed, so the
 * caller sees what it asked for and did not get.
 */
export class TokenScopeNotEntitledError extends Error {
  readonly code = ErrorCodes.TOKEN_SCOPE_NOT_ENTITLED;
  constructor(readonly scopes: string[]) {
    super(`Not entitled to grant: ${scopes.join(', ')}`);
    this.name = TokenScopeNotEntitledError.name;
  }
}
