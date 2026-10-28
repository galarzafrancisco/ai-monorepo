/**
 * Service layer types for Projects
 */

export type CreateProjectInput = {
  slug: string;
  description?: string;
  repoUrl?: string;
  color?: string;
  githubConnectionId?: string | null;
  githubForWorker?: boolean;
};

export type UpdateProjectInput = {
  description?: string;
  repoUrl?: string;
  /** Null: pick the connection automatically. */
  githubConnectionId?: string | null;
  githubForWorker?: boolean;
};

export type ProjectResult = {
  id: string;
  tagId: string;
  tagName: string;
  tagColor?: string;
  slug: string;
  description?: string;
  repoUrl?: string;
  githubConnectionId: string | null;
  githubForWorker: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchProjectsInput = {
  query: string;
  limit?: number;
  threshold?: number;
};
