import { AgentContextRow } from '../agent-context.utils';
import { ResolvedChatModel } from '../chat-model.factory';

export type BeforeTurnContext = {
  threadId: string;
  turnId: string;
  /** Text of the messages the agent is about to answer, oldest first. */
  newUserMessages: string[];
  /** The agent-side conversation as it stands, oldest first. */
  context: AgentContextRow[];
};

export type AfterTurnContext = {
  threadId: string;
  turnId: string;
  model: ResolvedChatModel;
  /** Input tokens of the turn's last model call: the size of the conversation. */
  lastInputTokens: number | null;
};

/**
 * Watches the conversation and can enrich or maintain the agent-side context.
 * Register implementations under THREAD_AGENT_HOOKS in ThreadsModule.
 */
export interface ThreadAgentHook {
  /** Recorded on injected rows as `hook:<name>`. */
  readonly name: string;

  /**
   * Runs after the new user messages are stored and before the model is called.
   * Return text to add to the agent-side conversation; the user never sees it.
   */
  beforeTurn?(context: BeforeTurnContext): Promise<string | null>;

  /** Runs after the reply was delivered, while the turn still holds the thread. */
  afterTurn?(context: AfterTurnContext): Promise<void>;
}

export const THREAD_AGENT_HOOKS = Symbol('THREAD_AGENT_HOOKS');
