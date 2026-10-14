import type { AssistantMessage, Event, Message, Part, SessionStatus } from '@opencode-ai/sdk/v2';

export type SessionMessage = { info: Message; parts: Part[] };

/**
 * The session an event belongs to, or `null` for server/global events.
 * Every session-scoped event in the v2 schema carries `properties.sessionID`.
 */
export function eventSessionId(event: Event): string | null {
  const props = event.properties as { sessionID?: unknown; info?: { sessionID?: unknown } } | undefined;
  if (typeof props?.sessionID === 'string') return props.sessionID;
  if (typeof props?.info?.sessionID === 'string') return props.info.sessionID;
  return null;
}

/**
 * The set of sessions one Taico execution owns: the root session plus any
 * sub-agent sessions OpenCode spawns from it. Events from any other session
 * (another execution sharing a server, a user poking the server, …) are dropped.
 */
export class OwnedSessions {
  private readonly ids = new Set<string>();

  constructor(readonly rootId: string) {
    this.ids.add(rootId);
  }

  /** Returns true when `event` belongs to this execution. Learns child sessions as they are created. */
  accept(event: Event): boolean {
    if (event.type === 'session.created' || event.type === 'session.updated') {
      const info = event.properties.info;
      if (info.parentID && this.ids.has(info.parentID)) {
        this.ids.add(info.id);
      }
    }
    const sessionId = eventSessionId(event);
    return sessionId !== null && this.ids.has(sessionId);
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  all(): string[] {
    return [...this.ids];
  }
}

export type OpencodeErrorShape = { name?: string; data?: { message?: string } } | undefined;

export function describeOpencodeError(error: OpencodeErrorShape | Error): string {
  if (!error) return 'unknown OpenCode session error';
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return `${error.name}: ${error.message}${cause instanceof Error ? ` (${cause.message})` : ''}`;
  }
  const message = error.data?.message;
  return message ? `${error.name ?? 'Error'}: ${message}` : (error.name ?? 'unknown OpenCode session error');
}

export function isAbortError(error: OpencodeErrorShape): boolean {
  return error?.name === 'MessageAbortedError';
}

/**
 * Decide from persisted state (not the event stream) whether the run on
 * `sessionId` has finished. Used after an SSE disconnect, when terminal events
 * may have been missed.
 *
 * Complete = OpenCode is not working on the session AND the newest message is
 * an assistant reply that either completed or failed. Checking the messages
 * guards against the window right after `promptAsync`, where the status map
 * can still say idle before the prompt is admitted.
 */
export function isRunComplete(
  sessionId: string,
  statuses: Record<string, SessionStatus> | undefined,
  messages: SessionMessage[],
): boolean {
  const status = statuses?.[sessionId];
  if (status && status.type !== 'idle') {
    return false;
  }
  const last = messages[messages.length - 1]?.info;
  if (!last || last.role !== 'assistant') {
    return false;
  }
  return Boolean(last.time.completed || last.error);
}

export type ReconciledUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
  assistantMessages: number;
};

export function assistantMessages(messages: SessionMessage[]): AssistantMessage[] {
  return messages.map((m) => m.info).filter((m): m is AssistantMessage => m.role === 'assistant');
}

/**
 * Authoritative usage for a run: the sum over every assistant message in the
 * owned sessions. Streaming `message.updated` events are only a preview; the
 * final number reported to Taico comes from here.
 */
export function reconcileUsage(messages: SessionMessage[]): ReconciledUsage {
  const usage: ReconciledUsage = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    cost: 0,
    assistantMessages: 0,
  };
  for (const info of assistantMessages(messages)) {
    const t = info.tokens;
    usage.inputTokens += t.input;
    usage.outputTokens += t.output;
    usage.reasoningTokens += t.reasoning;
    usage.cacheReadTokens += t.cache.read;
    usage.cacheWriteTokens += t.cache.write;
    usage.totalTokens += t.total ?? t.input + t.output + t.reasoning + t.cache.read + t.cache.write;
    usage.cost += info.cost;
    usage.assistantMessages += 1;
  }
  return usage;
}

/** Text of the final assistant message (what the agent "answered"). */
export function finalAssistantText(messages: SessionMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const { info, parts } = messages[i];
    if (info.role !== 'assistant') continue;
    const text = parts
      .filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text' && !p.synthetic)
      .map((p) => p.text)
      .join('\n')
      .trim();
    if (text) return text;
  }
  return '';
}

/** Error recorded on the newest assistant message, if any. */
export function lastAssistantError(messages: SessionMessage[]): OpencodeErrorShape {
  const assistants = assistantMessages(messages);
  return assistants[assistants.length - 1]?.error;
}

/**
 * Formats owned events into Taico activity lines. Only emits each part once,
 * when it is finished, to avoid the delta/update storm OpenCode produces.
 */
export class OpencodeV2EventFormatter {
  private readonly emittedParts = new Set<string>();
  private readonly startedTools = new Set<string>();

  constructor(private readonly agentSlug?: string) {}

  private get label() {
    return this.agentSlug ? `@${this.agentSlug}` : 'Assistant';
  }

  /** Returns the tool name the first time a tool call is seen running. */
  toolStarted(event: Event): string | null {
    if (event.type !== 'message.part.updated') return null;
    const part = event.properties.part;
    if (part.type !== 'tool' || part.state.status === 'pending' || this.startedTools.has(part.id)) return null;
    this.startedTools.add(part.id);
    return part.tool;
  }

  format(event: Event): string | null {
    if (event.type === 'session.error') {
      return `❌ ${this.label}: ${describeOpencodeError(event.properties.error)}`;
    }
    if (event.type === 'permission.asked') {
      return `🔐 ${this.label} requested permission '${event.properties.permission}' for ${event.properties.patterns.join(', ')}`;
    }
    if (event.type !== 'message.part.updated') return null;

    const part = event.properties.part;
    if (this.emittedParts.has(part.id)) return null;

    let line: string | null = null;
    switch (part.type) {
      case 'text':
        if (part.time?.end && part.text.trim() && !part.synthetic) line = `💬 ${this.label}: ${part.text}`;
        break;
      case 'reasoning':
        if (part.time.end) line = `💬 ${this.label}: Thinking...`;
        break;
      case 'tool':
        if (part.state.status === 'completed') line = `🔧 ${this.label} Tool call: ${part.tool}`;
        else if (part.state.status === 'error') line = `🔧 ${this.label} Tool call failed: ${part.tool} (${part.state.error})`;
        break;
      case 'subtask':
        line = `💬 ${this.label}: Creating subtask: ${part.description}`;
        break;
      case 'retry':
        line = `🔄 ${this.label} Retrying after '${part.error.name}' (attempt ${part.attempt})`;
        break;
      case 'compaction':
        line = `🚜 ${this.label} Compacting`;
        break;
      default:
        break;
    }
    if (line) this.emittedParts.add(part.id);
    return line;
  }
}
