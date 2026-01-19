import { TaskStatus } from '../../enums';
import { ActorType } from '../../../identity-provider/enums';

/**
 * Service layer types - transport agnostic
 * No Swagger decorators, no class-validator
 */

export type ActorResult = {
  id: string;
  type: ActorType;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
};

// Input types (for service methods)
export type CreateTaskInput = {
  name: string;
  description: string;
  assigneeActorId?: string;
  sessionId?: string;
  tagNames?: string[];
  createdByActorId: string;
  dependsOnIds?: string[];
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type AssignTaskInput = {
  assigneeActorId: string;
  sessionId?: string;
};

export type ChangeStatusInput = {
  status: TaskStatus;
  comment?: string;
};

export type CreateCommentInput = {
  commenterActorId: string;
  content: string;
};

export type ListTasksInput = {
  assignee?: string;
  sessionId?: string;
  tag?: string;
  page: number;
  limit: number;
};

export type AddTagInput = {
  name: string;
  color?: string;
};

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

export type TaskResult = {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignee: string | null;
  assigneeActor: ActorResult | null;
  sessionId: string | null;
  comments: CommentResult[];
  tags: TagResult[];
  createdByActor: ActorResult;
  dependsOnIds: string[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null | undefined;
};

export type CommentResult = {
  id: string;
  taskId: string;
  commenterName: string;
  commenterActor: ActorResult | null;
  content: string;
  createdAt: Date;
};

export type ListTasksResult = {
  items: TaskResult[];
  total: number;
  page: number;
  limit: number;
};
