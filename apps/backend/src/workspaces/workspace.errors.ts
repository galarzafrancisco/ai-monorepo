import { ErrorCodes } from '@taico/errors';

/** A row or entry point is in a workspace the caller is not in. Answers 404, like any row of another workspace. */
export class NotInWorkspaceError extends Error {
  readonly code = ErrorCodes.NOT_IN_WORKSPACE;
  constructor() {
    super('Not found');
    this.name = NotInWorkspaceError.name;
  }
}

/** The person is in no workspace, so no session token can be minted for them. */
export class NoWorkspaceMembershipError extends Error {
  readonly code = ErrorCodes.NO_WORKSPACE_MEMBERSHIP;
  constructor(readonly actorId: string) {
    super(`Actor ${actorId} is not a member of any workspace`);
    this.name = NoWorkspaceMembershipError.name;
  }
}

/**
 * The page sent the workspace it is showing (`x-taico-workspace`), but the
 * session is now in another one: another tab switched workspace. Refused so a
 * stale page can't read or write in a workspace it doesn't show.
 */
export class WorkspaceChangedError extends Error {
  readonly code = ErrorCodes.WORKSPACE_CHANGED;
  constructor() {
    super('Your session moved to another workspace. Reload the page.');
    this.name = WorkspaceChangedError.name;
  }
}

export class WorkspaceSlugConflictError extends Error {
  readonly code = ErrorCodes.WORKSPACE_SLUG_CONFLICT;
  constructor(readonly slug: string) {
    super(`A workspace with slug '${slug}' already exists`);
    this.name = WorkspaceSlugConflictError.name;
  }
}

/** The actor is not a member of the workspace (or does not exist). */
export class WorkspaceMemberNotFoundError extends Error {
  readonly code = ErrorCodes.WORKSPACE_MEMBER_NOT_FOUND;
  constructor(readonly actorId: string) {
    super('Member not found');
    this.name = WorkspaceMemberNotFoundError.name;
  }
}

export class WorkspaceMemberAlreadyExistsError extends Error {
  readonly code = ErrorCodes.WORKSPACE_MEMBER_ALREADY_EXISTS;
  constructor(readonly actorId: string) {
    super('Already a member of the workspace');
    this.name = WorkspaceMemberAlreadyExistsError.name;
  }
}

/** Removing or demoting this member would leave the workspace with no admin. */
export class WorkspaceLastAdminError extends Error {
  readonly code = ErrorCodes.WORKSPACE_LAST_ADMIN;
  constructor() {
    super('The workspace needs at least one admin');
    this.name = WorkspaceLastAdminError.name;
  }
}

/** Agents belong to one workspace for life: they are created and deleted, not invited or removed. */
export class WorkspaceMemberIsAgentError extends Error {
  readonly code = ErrorCodes.WORKSPACE_MEMBER_IS_AGENT;
  constructor(readonly actorId: string) {
    super('Agents are managed on the agents page, not as members');
    this.name = WorkspaceMemberIsAgentError.name;
  }
}
