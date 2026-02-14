import { TaskBlueprintResult } from './task-blueprints.service.types';

/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

// Input types
export type CreateScheduledTaskInput = {
  taskBlueprintId: string;
  cronExpression: string;
  enabled?: boolean;
};

export type UpdateScheduledTaskInput = {
  cronExpression?: string;
  enabled?: boolean;
};

export type ListScheduledTasksInput = {
  page: number;
  limit: number;
  enabled?: boolean;
};

// Result types
export type ScheduledTaskResult = {
  id: string;
  taskBlueprintId: string;
  taskBlueprint?: TaskBlueprintResult;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ListScheduledTasksResult = {
  items: ScheduledTaskResult[];
  total: number;
  page: number;
  limit: number;
};
