import type { ExecutionTraceResponseDto } from '@taico/client/v2';

export type TraceEvent = ExecutionTraceResponseDto;
export type TraceEntry = {
  id: string;
  kind: 'message' | 'thinking' | 'tool' | 'error' | 'system';
  title: string;
  text: string;
  input?: string;
  status?: string;
  events: TraceEvent[];
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const content = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (Array.isArray(value))
    return value
      .map((part) => string(object(part).text) || content(part))
      .join('\n');
  return JSON.stringify(value, null, 2);
};
const humanize = (value: string) =>
  value.replace(/[._-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

/** Project SDK events for reading; every underlying event remains inspectable. */
export function buildTraceEntries(events: TraceEvent[]): TraceEntry[] {
  const entries = new Map<string, TraceEntry>();
  const claudeMessageIds = new Map<string, string>();
  const claudeToolKeys = new Map<string, string>();
  const claudeStreamKeys = new Map<string, string>();
  const claudeBlocks = new Map<
    string,
    {
      scope: string;
      messageId?: string;
      type: string;
    }
  >();
  const resetStream = (scope: string) => {
    claudeMessageIds.delete(scope);
    for (const [key, block] of claudeBlocks) {
      if (block.scope === scope) claudeBlocks.delete(key);
    }
    for (const key of claudeStreamKeys.keys()) {
      if (key.startsWith(`${scope}:`)) claudeStreamKeys.delete(key);
    }
  };
  const put = (
    event: TraceEvent,
    key: string,
    patch: Omit<TraceEntry, 'id' | 'events'>,
    append = false,
  ) => {
    const previous = entries.get(key);
    const rawEvents = previous?.events ?? [];
    if (rawEvents.at(-1)?.sequence !== event.sequence) rawEvents.push(event);
    entries.set(key, {
      ...previous,
      ...patch,
      id: key,
      text: append ? (previous?.text ?? '') + patch.text : patch.text,
      events: rawEvents,
    });
  };
  for (const event of events) {
    if (event.source === 'worker') continue;
    const raw = object(event.payload);
    const scope = string(raw.parent_tool_use_id) || 'root';
    const type = string(raw.type);
    const data = object(raw.data);
    const properties = object(raw.properties);
    const message = object(raw.message);
    const parts = Array.isArray(message.content)
      ? message.content
      : Array.isArray(raw.content)
        ? raw.content
        : undefined;
    if (event.harness === 'claude' && type === 'stream_event') {
      const stream = object(raw.event);
      const streamMessage = object(stream.message);
      if (stream.type === 'message_start') resetStream(scope);
      if (streamMessage.id)
        claudeMessageIds.set(scope, string(streamMessage.id));
      const index = typeof stream.index === 'number' ? stream.index : 0;
      const block = object(stream.content_block);
      const delta = object(stream.delta);
      const slot = `${scope}:${index}`;
      const key =
        claudeStreamKeys.get(slot) ??
        `claude:${scope}:${claudeMessageIds.get(scope) || `partial-${event.sequence}`}:${index}`;
      if (
        stream.type === 'content_block_start' ||
        stream.type === 'content_block_delta'
      ) {
        claudeStreamKeys.set(slot, key);
        if (!claudeBlocks.has(key)) {
          claudeBlocks.set(key, {
            scope,
            messageId: claudeMessageIds.get(scope),
            type:
              string(block.type) ||
              (delta.type === 'thinking_delta'
                ? 'thinking'
                : delta.type === 'input_json_delta'
                  ? 'tool_use'
                  : 'text'),
          });
        }
      }
      if (stream.type === 'message_stop') resetStream(scope);
      if (stream.type === 'content_block_start') {
        if (block.type === 'tool_use' && block.id)
          claudeToolKeys.set(`${scope}:${string(block.id)}`, key);
        put(event, key, {
          kind:
            block.type === 'tool_use'
              ? 'tool'
              : block.type === 'thinking'
                ? 'thinking'
                : 'message',
          title:
            string(block.name) ||
            (block.type === 'thinking' ? 'Thinking' : 'Assistant'),
          text: string(block.text) || string(block.thinking),
          input: block.type === 'tool_use' ? content(block.input) : undefined,
        });
      } else if (stream.type === 'content_block_delta') {
        const previous = entries.get(key);
        if (delta.type === 'input_json_delta') {
          put(event, key, {
            kind: 'tool',
            title: previous?.title ?? 'Tool call',
            text: previous?.text ?? '',
            input:
              (previous?.input === '{}' ? '' : (previous?.input ?? '')) +
              string(delta.partial_json),
          });
        } else if (
          delta.type === 'text_delta' ||
          delta.type === 'thinking_delta'
        ) {
          put(
            event,
            key,
            {
              kind: delta.type === 'thinking_delta' ? 'thinking' : 'message',
              title: delta.type === 'thinking_delta' ? 'Thinking' : 'Assistant',
              text: string(delta.text) || string(delta.thinking),
            },
            true,
          );
        } else if (previous) {
          put(event, key, {
            kind: previous.kind,
            title: previous.title,
            text: previous.text,
            input: previous.input,
            status: previous.status,
          });
        } else {
          put(event, `event:${event.sequence}`, {
            kind: 'system',
            title: humanize(string(delta.type) || 'Stream update'),
            text: '',
          });
        }
      } else {
        put(event, `event:${event.sequence}`, {
          kind: 'system',
          title: humanize(string(stream.type) || type),
          text: '',
        });
      }
      continue;
    }
    if (parts) {
      parts.forEach((value, index) => {
        const part = object(value);
        const partType = string(part.type);
        if (partType === 'tool_result') {
          const key =
            claudeToolKeys.get(`${scope}:${string(part.tool_use_id)}`) ??
            `tool:${string(part.tool_use_id) || event.sequence}`;
          put(event, key, {
            kind: 'tool',
            title: entries.get(key)?.title ?? 'Tool result',
            text: content(part.content),
            status: part.is_error ? 'Failed' : 'Completed',
          });
        } else {
          // The SDK emits one assistant event per completed block, sharing the
          // message ID. Its content-array index is NOT the stream block index.
          const messageId = string(message.id);
          const streamed = [...claudeBlocks].find(
            ([, block]) =>
              block.scope === scope &&
              block.type === partType &&
              (!block.messageId || block.messageId === messageId),
          );
          const key =
            (partType === 'tool_use'
              ? claudeToolKeys.get(`${scope}:${string(part.id)}`)
              : undefined) ??
            streamed?.[0] ??
            `claude:${scope}:${messageId || event.sequence}:${string(raw.uuid) || event.sequence}:${index}`;
          claudeBlocks.delete(key);
          if (partType === 'tool_use' && part.id)
            claudeToolKeys.set(`${scope}:${string(part.id)}`, key);
          put(event, key, {
            kind:
              partType === 'tool_use'
                ? 'tool'
                : partType === 'thinking'
                  ? 'thinking'
                  : 'message',
            title:
              string(part.name) ||
              (partType === 'thinking'
                ? 'Thinking'
                : type === 'user'
                  ? 'User'
                  : 'Assistant'),
            text: string(part.text) || string(part.thinking),
            input: partType === 'tool_use' ? content(part.input) : undefined,
            status: partType === 'tool_use' ? 'Running' : undefined,
          });
        }
      });
      if (!parts.length)
        put(event, `event:${event.sequence}`, {
          kind: 'system',
          title: humanize(type || 'Message'),
          text: '',
        });
      continue;
    }
    if (type === 'message.part.updated') {
      const part = object(properties.part);
      const state = object(part.state);
      const key = `part:${string(part.id) || event.sequence}`;
      const delta = string(properties.delta);
      put(
        event,
        key,
        {
          kind:
            part.type === 'tool'
              ? 'tool'
              : part.type === 'reasoning'
                ? 'thinking'
                : part.type === 'text'
                  ? 'message'
                  : 'system',
          title:
            string(part.tool) ||
            (part.type === 'reasoning'
              ? 'Thinking'
              : part.type === 'text'
                ? 'Assistant'
                : humanize(string(part.type))),
          text:
            part.type === 'tool'
              ? content(state.output ?? state.error)
              : string(part.text) || delta,
          input: part.type === 'tool' ? content(state.input) : undefined,
          status: string(state.status) || undefined,
        },
        Boolean(delta && !part.text),
      );
      continue;
    }
    if (type === 'message.part.delta') {
      const key = `part:${string(properties.partID)}`;
      put(
        event,
        key,
        {
          kind: entries.get(key)?.kind ?? 'message',
          title: entries.get(key)?.title ?? 'Assistant',
          text: string(properties.delta),
        },
        true,
      );
      continue;
    }
    if (type.startsWith('tool.execution_')) {
      const key = `tool:${string(data.toolCallId) || event.sequence}`;
      const previous = entries.get(key);
      put(event, key, {
        kind: 'tool',
        title: string(data.toolName) || previous?.title || 'Tool call',
        input:
          data.arguments !== undefined
            ? content(data.arguments)
            : previous?.input,
        text: content(data.result ?? data.error),
        status: type.endsWith('complete')
          ? data.success === false
            ? 'Failed'
            : 'Completed'
          : 'Running',
      });
      continue;
    }
    if (
      type.startsWith('assistant.message') ||
      type.startsWith('assistant.reasoning')
    ) {
      const thinking = type.startsWith('assistant.reasoning');
      const key = `${thinking ? 'reasoning' : 'message'}:${string(data.messageId) || string(data.reasoningId) || event.sequence}`;
      put(
        event,
        key,
        {
          kind: thinking ? 'thinking' : 'message',
          title: thinking ? 'Thinking' : 'Assistant',
          text: string(data.content) || string(data.deltaContent),
        },
        type.endsWith('_delta'),
      );
      continue;
    }
    const adkContent = object(raw.content);
    if (Array.isArray(adkContent.parts)) {
      adkContent.parts.forEach((value, index) => {
        const part = object(value);
        const call = object(part.functionCall ?? part.functionResponse);
        const tool = Boolean(part.functionCall || part.functionResponse);
        const key =
          tool && call.id
            ? `adk:tool:${string(call.id)}`
            : `adk:${string(raw.id) || event.sequence}:${index}`;
        const previous = entries.get(key);
        put(event, key, {
          kind: tool ? 'tool' : part.thought ? 'thinking' : 'message',
          title:
            string(call.name) ||
            (part.thought ? 'Thinking' : string(raw.author) || 'Assistant'),
          text: tool ? content(call.response) : string(part.text),
          input: part.functionCall ? content(call.args) : previous?.input,
          status: part.functionResponse
            ? 'Completed'
            : tool
              ? 'Running'
              : undefined,
        });
      });
      continue;
    }
    const isError = type.includes('error') || Boolean(raw.is_error);
    put(event, `event:${event.sequence}`, {
      kind: isError ? 'error' : 'system',
      title: humanize(string(raw.subtype) || type || 'Harness event'),
      text: content(
        raw.result ??
          object(data.error).message ??
          data.message ??
          raw.error ??
          raw.text,
      ),
    });
  }
  return [...entries.values()];
}

export function mergeTraceEvents(
  current: TraceEvent[],
  incoming: TraceEvent[],
): TraceEvent[] {
  // Live delivery normally appends; avoid rebuilding and sorting the whole run.
  if (
    !current.length ||
    !incoming.length ||
    incoming[0].sequence > current[current.length - 1].sequence
  )
    return [...current, ...incoming];
  const merged = new Map(current.map((event) => [event.sequence, event]));
  for (const event of incoming) merged.set(event.sequence, event);
  return [...merged.values()].sort((a, b) => a.sequence - b.sequence);
}

/** Argument keys that usually say what a tool call is about, most telling first. */
const SUMMARY_KEYS = ['command', 'pattern', 'query', 'file_path', 'filePath', 'path', 'url', 'description', 'prompt', 'name', 'id'];

/**
 * A one-line hint of what a tool was called with, e.g. the command or file,
 * for the collapsed row. Empty when nothing short and telling is found.
 */
export function summarizeToolInput(input: string | undefined, maxLength = 80): string {
  if (!input) return '';
  let value: unknown = input;
  try {
    value = JSON.parse(input);
  } catch {
    // Not JSON: use the text itself.
  }
  let summary = '';
  if (typeof value === 'string') {
    summary = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const args = value as Record<string, unknown>;
    const key = SUMMARY_KEYS.find((candidate) => typeof args[candidate] === 'string' && args[candidate] !== '');
    const fallback = Object.values(args).find((candidate): candidate is string => typeof candidate === 'string' && candidate !== '');
    summary = key ? (args[key] as string) : fallback ?? '';
  }
  summary = summary.replace(/\s+/g, ' ').trim();
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1)}…` : summary;
}

/** "mcp__tasks__add_comment" → { server: "tasks", tool: "add_comment" }; other names pass through. */
export function splitToolName(name: string): { server: string | null; tool: string } {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return match ? { server: match[1], tool: match[2] } : { server: null, tool: name };
}
