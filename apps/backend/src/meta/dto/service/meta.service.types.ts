/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

// Input types (for service methods)
export type CreateTagInput = {
  name: string;
  color?: string;
};

// Result types (from service methods)
export type TagResult = {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VersionResult = {
  backend: string;
  ui: string;
};
