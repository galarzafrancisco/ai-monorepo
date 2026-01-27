/**
 * Service layer types for Projects
 */

export type CreateProjectInput = {
  slug: string;
  description?: string;
  repoUrl?: string;
  color?: string;
};

export type UpdateProjectInput = {
  description?: string;
  repoUrl?: string;
};

export type ProjectResult = {
  id: string;
  tagId: string;
  tagName: string;
  tagColor?: string;
  slug: string;
  description?: string;
  repoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchProjectsInput = {
  query: string;
  limit?: number;
  threshold?: number;
};
