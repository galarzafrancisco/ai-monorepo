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
  introduction: string | null;
};

export type TaskResult = {
  id: string;
  name: string;
};

// Input types (for service methods)
export type CreateAgentRunInput = {
  actorId: string;
  parentTaskId: string;
};

export type UpdateAgentRunInput = {
  startedAt?: Date | null;
  endedAt?: Date | null;
  lastPing?: Date | null;
};

// Result types (from service methods)
export type AgentRunResult = {
  id: string;
  actorId: string;
  actor: ActorResult | null;
  parentTaskId: string;
  parentTask: TaskResult | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  lastPing: Date | null;
};

export type ListAgentRunsInput = {
  actorId?: string;
  parentTaskId?: string;
  page: number;
  limit: number;
};

export type ListAgentRunsResult = {
  items: AgentRunResult[];
  total: number;
  page: number;
  limit: number;
};
