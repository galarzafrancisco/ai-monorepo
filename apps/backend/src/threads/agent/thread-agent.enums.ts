export enum ThreadAgentMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export enum ThreadAgentMessageKind {
  /** A regular conversation message. */
  MESSAGE = 'message',
  /** Context added by a hook. Never shown to the user. */
  INJECTION = 'injection',
  /** A compaction summary. Context loading stops walking back here. */
  SUMMARY = 'summary',
}

export enum ThreadTurnStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** Bump when the JSON shape stored in thread_agent_messages.message changes. */
export const THREAD_AGENT_MESSAGE_FORMAT_VERSION = 1;
