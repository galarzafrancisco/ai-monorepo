import { UserRole } from '../../enums';
import { WorkspaceRole } from '../../../workspaces/enums';

/**
 * The workspace a new person joins, and their role there. Every person is
 * created in a workspace; without one they could not sign in.
 */
export type NewUserWorkspace = {
  workspaceId: string;
  role: WorkspaceRole;
};

/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

// Input types (for service methods)
export type CreateUserInput = {
  email: string;
  displayName: string;
  slug: string;
  password: string;
  introduction?: string;
  /** Defaults to the default workspace, as a member. */
  workspace?: NewUserWorkspace;
};

export type CreateManagedUserInput = {
  email: string;
  /** The installation role: `admin` makes them an installation operator. */
  role: UserRole;
  /**
   * Defaults to the default workspace, as an admin if `role` is admin and a
   * member otherwise.
   */
  workspace?: NewUserWorkspace;
};

export type SetupManagedUserInput = {
  email: string;
  displayName: string;
  slug: string;
  password: string;
};

export type UpdateUserRoleInput = {
  role: UserRole;
};
