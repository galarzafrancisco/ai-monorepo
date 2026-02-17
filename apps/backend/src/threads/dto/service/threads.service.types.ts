import { ActorType } from '../../../identity-provider/enums';
import { TaskStatus } from '../../../tasks/enums';

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
  introduction: string | null;
};

export type TagResult = {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskSummaryResult = {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assigneeActor: ActorResult | null;
  createdByActor: ActorResult;
  tags: TagResult[];
  commentCount: number;
  inputRequests: any[]; // InputRequestEntity type
  updatedAt: Date;
};

export type ContextBlockSummaryResult = {
  id: string;
  title: string;
};

// Input types (for service methods)
export type CreateThreadInput = {
  title?: string;
  createdByActorId: string;
  parentTaskId?: string;
  tagNames?: string[];
  taskIds?: string[];
  contextBlockIds?: string[];
  participantActorIds?: string[];
};

export type UpdateThreadInput = {
  title?: string;
};

export type AddTagInput = {
  name: string;
};

export type ListThreadsInput = {
  page: number;
  limit: number;
};

// Result types (from service methods)
export type ThreadResult = {
  id: string;
  title: string;
  createdByActor: ActorResult;
  parentTaskId: string | null;
  stateContextBlockId: string;
  tasks: TaskSummaryResult[];
  referencedContextBlocks: ContextBlockSummaryResult[];
  tags: TagResult[];
  participants: ActorResult[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null | undefined;
};

export type ThreadListItemResult = {
  id: string;
  title: string;
};

export type ListThreadsResult = {
  items: ThreadListItemResult[];
  total: number;
  page: number;
  limit: number;
};

// Thread message types
export type CreateThreadMessageInput = {
  threadId: string;
  content: string;
  createdByActorId: string;
};

export type ThreadMessageResult = {
  id: string;
  threadId: string;
  content: string;
  createdByActorId: string | null;
  createdByActor: ActorResult | null;
  createdAt: Date;
};

export type ListThreadMessagesInput = {
  threadId: string;
  page: number;
  limit: number;
};

export type ListThreadMessagesResult = {
  items: ThreadMessageResult[];
  total: number;
  page: number;
  limit: number;
};
