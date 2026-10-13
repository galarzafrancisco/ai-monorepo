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

/** What a hook added for one turn. */
export type TurnContext = {
  /** Name of the hook that produced it. */
  source: string;
  text: string;
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
   * Return text for the model, or null. The user never sees it.
   *
   * The text goes into the system instructions of this turn only, so the model
   * gives it the same weight as the agent's own prompt. Do not pass text written
   * by users or fetched from outside through unchanged: state facts and what to
   * do about them, in plain terms. Later turns do not see it again.
   */
  beforeTurn?(context: BeforeTurnContext): Promise<string | null>;

  /** Runs after the reply was delivered, while the turn still holds the thread. */
  afterTurn?(context: AfterTurnContext): Promise<void>;
}

export const THREAD_AGENT_HOOKS = Symbol('THREAD_AGENT_HOOKS');
