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

/**
 * No open invitation has this code: wrong, already used, revoked or expired.
 * One answer for all of them, so codes can't be probed.
 */
export class WorkspaceInvitationNotFoundError extends Error {
  readonly code = ErrorCodes.WORKSPACE_INVITATION_NOT_FOUND;
  constructor() {
    super('Invitation not found or no longer valid');
    this.name = WorkspaceInvitationNotFoundError.name;
  }
}

/** The signed-in account's email isn't the one the invitation was sent to. */
export class WorkspaceInvitationEmailMismatchError extends Error {
  readonly code = ErrorCodes.WORKSPACE_INVITATION_EMAIL_MISMATCH;
  constructor() {
    super('This invitation is for another email address');
    this.name = WorkspaceInvitationEmailMismatchError.name;
  }
}

/** An account with the invited email exists: sign in to it to accept. */
export class WorkspaceInvitationAccountExistsError extends Error {
  readonly code = ErrorCodes.WORKSPACE_INVITATION_ACCOUNT_EXISTS;
  constructor() {
    super('An account with this email exists. Sign in to accept the invitation.');
    this.name = WorkspaceInvitationAccountExistsError.name;
  }
}

/**
 * The token is for a workspace its actor is no longer a member of (they were
 * removed after it was minted). Refreshing the session moves them to a
 * workspace they are still in.
 */
export class WorkspaceMembershipRevokedError extends Error {
  readonly code = ErrorCodes.WORKSPACE_MEMBERSHIP_REVOKED;
  constructor() {
    super('You are no longer a member of this workspace');
    this.name = WorkspaceMembershipRevokedError.name;
  }
}
