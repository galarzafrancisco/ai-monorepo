export type RuntimeMcpServerConfig =
  | {
      type: 'http';
      url: string;
      headers: Record<string, string>;
    }
  | {
      type: 'stdio';
      command: string;
      args: string[];
    };

export type AgentRunContext = {
  taskId: string;
  prompt: string;
  cwd: string;
  executionId: string;
  accessToken: string;
  baseUrl: string;
  resume?: string;
  options?: Record<string, unknown>;
  agentSlug?: string;
  mcpServers?: Record<string, RuntimeMcpServerConfig>;
  allowedTools?: string[];
};

export type AgentRunCallbacks = {
  onSession?: (sessionId: string) => void | Promise<void>;
  onEvent?: (message: string) => void | Promise<void>;
  onError?: (error: {
    message: string;
    rawMessage?: unknown;
  }) => void | Promise<void>;
};

export type AgentRunResult = {
  sessionId: string | null;
  events: string[];
  result: string;
};

export interface AgentRunner {
  readonly kind: string;

  run(ctx: AgentRunContext, cb?: AgentRunCallbacks): Promise<AgentRunResult>;
}
