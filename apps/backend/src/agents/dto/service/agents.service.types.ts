import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../../../agents/enums';

export type CreateAgentInput = {
  slug: string;
  name: string;
  type?: AgentType;
  description?: string;
  introduction?: string;
  systemPrompt: string;
  providerId?: string;
  modelId?: string;
  statusTriggers: TaskStatus[];
  tagTriggers?: string[];
  allowedTools: string[];
  isActive?: boolean;
  concurrencyLimit?: number;
  avatarUrl?: string;
};

export type UpdateAgentInput = Partial<CreateAgentInput>;

export type PatchAgentInput = {
  systemPrompt?: string;
  statusTriggers?: TaskStatus[];
  tagTriggers?: string[];
  type?: AgentType;
  avatarUrl?: string;
  introduction?: string;
  providerId?: string;
  modelId?: string;
};

export type AgentResult = {
  actorId: string;
  slug: string;
  name: string;
  type: AgentType;
  description: string | null;
  introduction: string | null;
  systemPrompt: string;
  providerId: string | null;
  modelId: string | null;
  statusTriggers: TaskStatus[];
  tagTriggers: string[];
  allowedTools: string[];
  isActive: boolean;
  concurrencyLimit: number | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ListAgentsInput = {
  isActive?: boolean;
  page: number;
  limit: number;
};

export type ListAgentsResult = {
  items: AgentResult[];
  total: number;
  page: number;
  limit: number;
};
