export type Model = {
  providerId: string;
  modelId: string;
}

export type AgentModelConfig = {
  providerId?: string | null;
  modelId?: string | null;
}

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

  /** For backend traceability */
  runId: string;

  model?: Model;

  /** Agent slug for personalized activity messages */
  agentSlug?: string;
};

export type AgentRunCallbacks = {
  /** Called once when a session/run ID is known */
  onSession?: (sessionId: string) => void | Promise<void>;

  /** Called for every human-readable event */
  onEvent?: (message: string) => void | Promise<void>;

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

  run(
    ctx: AgentRunContext,
    cb?: AgentRunCallbacks
  ): Promise<AgentRunResult>;
}
