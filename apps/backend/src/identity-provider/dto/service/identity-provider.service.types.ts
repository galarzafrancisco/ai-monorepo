import { UserRole } from '../../enums';

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
};

export type CreateManagedUserInput = {
  email: string;
  role: UserRole;
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
