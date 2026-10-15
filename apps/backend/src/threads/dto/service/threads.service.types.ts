import { ActorType } from '../../../identity-provider/enums';
import { TaskStatus } from '../../../tasks/enums';
import { ThreadTimerKind } from '../../timers/thread-timer.enums';

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
  deletedAt: Date | null;
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

export type TaskSubscriptionResult = {
  taskId: string;
  name: string;
  status: TaskStatus;
  createdAt: Date;
};

/** A reminder or recurring schedule of the threads agent that will still fire. */
export type ThreadTimerResult = {
  id: string;
  kind: ThreadTimerKind;
  /** What the agent wants to be reminded of. */
  reason: string;
  /** Seconds between firings; null for a reminder. */
  periodSeconds: number | null;
  maxIterations: number;
  /** Firings so far. */
  firedCount: number;
  nextFireAt: Date;
  createdAt: Date;
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
  /** Whose unread counts to report. Without it every count is 0. */
  actorId?: string;
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
  taskSubscriptions: TaskSubscriptionResult[];
  /** Reminders and schedules that will still fire, soonest first. */
  timers: ThreadTimerResult[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null | undefined;
};

export type ThreadListItemResult = {
  id: string;
  title: string;
  stateContextBlockId: string;
  lastActivityAt: Date;
  unreadCount: number;
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

/** Token figures the model provider reported for a thread. Null where it reported none. */
export type ThreadTokenUsageResult = {
  /** Input tokens of the most recent model step. */
  contextTokens: number | null;
  /** Input tokens summed over every model step. */
  inputTokens: number | null;
  /** Output tokens summed over every model step. */
  outputTokens: number | null;
  /** Model steps that reported usage. */
  steps: number;
};
