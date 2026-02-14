import { ActorResult } from '../../../tasks/dto/service/tasks.service.types';
import { TagResult } from '../../../tasks/dto/service/tasks.service.types';

/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

// Input types
export type CreateTaskBlueprintInput = {
  name: string;
  description: string;
  assigneeActorId?: string;
  tagNames?: string[];
  dependsOnIds?: string[];
  createdByActorId: string;
};

export type UpdateTaskBlueprintInput = {
  name?: string;
  description?: string;
  assigneeActorId?: string | null;
  tagNames?: string[];
  dependsOnIds?: string[];
};

export type ListTaskBlueprintsInput = {
  page: number;
  limit: number;
};

// Result types
export type TaskBlueprintResult = {
  id: string;
  name: string;
  description: string;
  assigneeActorId: string | null;
  assigneeActor: ActorResult | null;
  tags: TagResult[];
  dependsOnIds: string[];
  createdByActor: ActorResult;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ListTaskBlueprintsResult = {
  items: TaskBlueprintResult[];
  total: number;
  page: number;
  limit: number;
};
