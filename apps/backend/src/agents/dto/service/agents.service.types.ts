export type CreateAgentInput = {
  slug: string;
  name: string;
  description?: string;
  systemPrompt: string;
  allowedTools: string[];
  isActive?: boolean;
  concurrencyLimit?: number;
};

export type UpdateAgentInput = {
  slug?: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  isActive?: boolean;
  concurrencyLimit?: number;
};

export type AgentResult = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  systemPrompt: string;
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
