import { ActorEntity } from 'src/identity-provider/actor.entity';

export type ChatStreamEvent =
  | { type: 'agent_activity'; kind: 'thinking' | 'tool_calling' }
  | { type: 'response_delta'; delta: string }
  | { type: 'final_response'; content: string }
  | { type: 'error'; error: Error };

export interface StreamMessageArgs {
  conversationId: string;
  threadId: string;
  message: string;
  actor: ActorEntity;
  agentName: string;
  systemPrompt: string;
  modelId: string | null;
  token: string;
}

export interface RunTaskArgs {
  instructions: string;
  prompt: string;
  token: string;
  modelId: string | null;
}

export interface ChatBackend {
  ensureAvailable(): Promise<void>;
  createConversation(threadId: string): Promise<{ id: string }>;
  streamMessage(args: StreamMessageArgs): AsyncGenerator<ChatStreamEvent>;
  /** One-shot text generation with no tools. Returns null on failure. */
  generateText(prompt: string, modelId: string | null): Promise<string | null>;
  /** One-shot agentic run with MCP tools. Text output is discarded; only side effects matter. */
  runTask(args: RunTaskArgs): Promise<void>;
}
