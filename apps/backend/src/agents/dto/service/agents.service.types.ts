import { TaskStatus } from "src/tasks/enums";
import { AgentType } from "../../../agents/enums";

export type CreateAgentInput = {
  slug: string;
  name: string;
  type?: AgentType;
  description?: string;
  systemPrompt: string;
  statusTriggers: TaskStatus[];
  allowedTools: string[];
  isActive?: boolean;
  concurrencyLimit?: number;
};

export type UpdateAgentInput = Partial<CreateAgentInput>

export type AgentResult = {
  actorId: string;
  slug: string;
  name: string;
  type: AgentType;
  description: string | null;
  systemPrompt: string;
  statusTriggers: TaskStatus[];
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
