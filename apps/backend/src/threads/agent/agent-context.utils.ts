import { ModelMessage, modelMessageSchema } from 'ai';
import {
  THREAD_AGENT_MESSAGE_FORMAT_VERSION,
  ThreadAgentMessageKind,
} from './thread-agent.enums';
import { addContextKey } from './thread-agent.prompts';

export type AgentContextRow = {
  id: string;
  kind: ThreadAgentMessageKind;
  /** Who produced the row, e.g. 'user', 'model', 'hook:easter-egg'. */
  source: string;
  message: unknown;
  formatVersion: number;
  providerType: string | null;
  modelId: string | null;
};

export type TargetModel = {
  providerType: string;
  modelId: string;
};

type MessagePart = { type?: string; providerOptions?: unknown };

/**
 * Reasoning parts and provider options carry signatures and item ids that only
 * the model that produced them accepts. Drop them when replaying to another one.
 */
function stripProviderSpecificParts(
  message: Record<string, unknown>,
): Record<string, unknown> | null {
  const { providerOptions: _providerOptions, ...rest } = message;

  if (!Array.isArray(rest.content)) {
    return rest;
  }

  const content = (rest.content as MessagePart[])
    .filter((part) => !part.type?.startsWith('reasoning'))
    .map(({ providerOptions: _partOptions, ...part }) => part);

  return content.length > 0 ? { ...rest, content } : null;
}

/**
 * Marks the rows Taico wrote itself (hook context, task notifications,
 * summaries) with the thread's key, so the model can tell them from a tag
 * someone typed. Rows are stored without the key: it is added on the way to
 * the model, which also covers rows written before threads had a key.
 */
export function withContextKey(rows: AgentContextRow[], contextKey: string): AgentContextRow[] {
  return rows.map((row) => {
    if (row.kind === ThreadAgentMessageKind.MESSAGE) {
      return row;
    }

    const message = row.message as { content?: unknown } | null;
    if (typeof message?.content !== 'string') {
      return row;
    }

    return { ...row, message: { ...message, content: addContextKey(message.content, contextKey) } };
  });
}

/**
 * Turns stored agent-log rows (oldest first) into the messages sent to `target`.
 * Rows that no longer match the message schema are skipped and reported.
 */
export function buildModelMessages(
  rows: AgentContextRow[],
  target: TargetModel,
  onInvalidRow?: (row: AgentContextRow) => void,
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const row of rows) {
    if (
      row.formatVersion !== THREAD_AGENT_MESSAGE_FORMAT_VERSION ||
      typeof row.message !== 'object' ||
      row.message === null
    ) {
      onInvalidRow?.(row);
      continue;
    }

    const producedByOtherModel =
      row.providerType !== null &&
      (row.providerType !== target.providerType || row.modelId !== target.modelId);

    const candidate = producedByOtherModel
      ? stripProviderSpecificParts(row.message as Record<string, unknown>)
      : row.message;

    if (!candidate) {
      continue;
    }

    const parsed = modelMessageSchema.safeParse(candidate);
    if (!parsed.success) {
      onInvalidRow?.(row);
      continue;
    }

    messages.push(parsed.data);
  }

  return messages;
}
