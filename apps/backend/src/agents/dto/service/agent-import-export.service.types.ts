import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../../enums';

export const AGENT_DEFINITION_VERSION = 1;

export type AgentToolPermissionDefinition = {
  serverProvidedId: string;
  scopeIds: string[];
};

export type AgentDefinition = {
  slug: string;
  name: string;
  type?: AgentType;
  description?: string | null;
  introduction?: string | null;
  avatarUrl?: string | null;
  systemPrompt: string;
  followUpPrompt?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  statusTriggers?: TaskStatus[];
  tagTriggers?: string[];
  allowedTools?: string[];
  isActive?: boolean;
  concurrencyLimit?: number | null;
  toolPermissions?: AgentToolPermissionDefinition[];
};

export type AgentDefinitionsDocument = {
  version: number;
  agents: AgentDefinition[];
};

export type ImportAgentIssue = {
  slug: string;
  reason: string;
};

export type ImportAgentsResult = {
  created: string[];
  updated: string[];
  failed: ImportAgentIssue[];
  warnings: ImportAgentIssue[];
};
