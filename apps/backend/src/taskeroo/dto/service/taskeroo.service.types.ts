import { TaskStatus } from '../../task.entity';

/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

// Input types (for service methods)
export type CreateTaskInput = {
  name: string;
  description: string;
  assignee?: string;
  sessionId?: string;
};

export type UpdateTaskInput = {
  description: string;
};

export type AssignTaskInput = {
  assignee?: string | null;
};

export type ChangeStatusInput = {
  status: TaskStatus;
  comment?: string;
};

export type CreateCommentInput = {
  commenterName: string;
  content: string;
};

export type ListTasksInput = {
  assignee?: string;
  sessionId?: string;
  page: number;
  limit: number;
};

// Result types (from service methods)
export type TaskResult = {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignee: string | null;
  sessionId: string | null;
  comments: CommentResult[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null | undefined;
};

export type CommentResult = {
  id: string;
  taskId: string;
  commenterName: string;
  content: string;
  createdAt: Date;
};

export type ListTasksResult = {
  items: TaskResult[];
  total: number;
  page: number;
  limit: number;
};
