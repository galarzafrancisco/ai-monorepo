export type Model = {
  providerId: string;
  modelId: string;
}

export type AgentModelConfig = {
  providerId?: string | null;
  modelId?: string | null;
}

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
  /** Task / job identity */
  taskId: string;

  /** Initial input */
  prompt: string;

  /** Working directory or sandbox */
  cwd: string;

  /** Taico server base URL for MCP endpoints */
  baseUrl: string;

  /** Short-lived agent execution token for MCP access */
  accessToken: string;

  /** Resume a previous run if supported */
  resume?: string;

  /** Arbitrary agent-specific config */
  options?: Record<string, any>;

  /** For backend traceability and MCP context */
  executionId: string;

  model?: Model;

  /** Agent slug for personalized activity messages */
  agentSlug?: string;

  /** Runtime MCP servers that should be mounted for this run */
  mcpServers?: Record<string, RuntimeMcpServerConfig>;

  /** Allowed tool list for SDKs that support tool filtering */
  allowedTools?: string[];

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
};

export type AgentRunCallbacks = {
  /** Called periodically while the runner is actively executing */
  onHeartbeat: () => void | Promise<void>;

  /** Called once when a session/run ID is known */
  onSession?: (sessionId: string) => void | Promise<void>;

  /** Called for every human-readable event */
  onEvent?: (message: string) => void | Promise<void>;

  /** Called whenever the runner initiates a tool call */
  onToolCall?: (toolName: string) => void | Promise<void>;

  /** Called when an error occurs (e.g., quota limit, API errors) */
  onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>;
};

export type AgentRunResult = {
  sessionId: string | null;
  events: string[];
  result: string;
};

export interface AgentRunner {
  readonly kind: string;

  cancel?(): void | Promise<void>;

  run(
    ctx: AgentRunContext,
    cb?: AgentRunCallbacks
  ): Promise<AgentRunResult>;
}
