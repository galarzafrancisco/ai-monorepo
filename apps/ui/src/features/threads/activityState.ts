import type { AgentActivityWireEvent } from '@taico/events';
import type { TraceEntry } from '../tasks/traces/traceEntries';

export type ActivityState = {
  turnId: string | null;
  startedAt: string | null;
  entries: TraceEntry[];
  stepActive: boolean;
  pendingTools: string[];
};

export const emptyActivity: ActivityState = {
  turnId: null, startedAt: null, entries: [], stepActive: false, pendingTools: [],
};

export function updateActivity(state: ActivityState, event: AgentActivityWireEvent['payload'], now: string): ActivityState {
  // A turn with no activity must not erase the previous inspectable trace;
  // a completion from an older turn must not replace newer in-flight work.
  if (event.kind === 'turn_end' && event.turnId !== state.turnId) {
    return state;
  }
  const current = event.turnId && event.turnId !== state.turnId
    ? { ...emptyActivity, turnId: event.turnId }
    : state;
  if (event.kind === 'turn_end') {
    return { ...current, stepActive: false, pendingTools: [] };
  }
  if (event.kind === 'step_end') {
    return { ...current, stepActive: false };
  }
  const tool = Boolean(event.toolCallId);
  const id = tool ? `tool:${event.toolCallId}` :
    current.entries.at(-1)?.kind === 'thinking' && current.stepActive
      ? current.entries.at(-1)!.id : `thinking:${now}`;
  const index = current.entries.findIndex((entry) => entry.id === id);
  const previous = current.entries[index];
  const entry: TraceEntry = {
    id,
    kind: tool ? 'tool' : 'thinking',
    title: event.toolName ?? (tool ? 'Tool call' : 'Thinking'),
    text: event.output ?? previous?.text ?? '',
    input: event.input ?? previous?.input,
    status: event.kind === 'tool_result' ? (event.failed ? 'Failed' : 'Completed') : tool ? 'Running' : undefined,
    events: [],
    timestamp: previous?.timestamp ?? now,
  };
  const pendingTools = event.toolCallId
    ? event.kind === 'tool_result'
      ? current.pendingTools.filter((callId) => callId !== event.toolCallId)
      : current.pendingTools.includes(event.toolCallId)
        ? current.pendingTools : [...current.pendingTools, event.toolCallId]
    : current.pendingTools;
  return {
    ...current,
    startedAt: current.startedAt ?? now,
    entries: index < 0 ? [...current.entries, entry] : current.entries.map((item, i) => i === index ? entry : item),
    stepActive: event.kind === 'thinking' ? true : current.stepActive,
    pendingTools,
  };
}

export const liveEntryId = (state: ActivityState): string | null =>
  state.pendingTools.length ? `tool:${state.pendingTools.at(-1)}` :
    state.stepActive && state.entries.at(-1)?.kind === 'thinking' ? state.entries.at(-1)!.id : null;

/** Insert the trace immediately before the first message saved after it began. */
export function traceInsertionIndex(startedAt: string | null, messages: { createdAt: string }[]): number {
  return startedAt ? messages.findIndex((message) => message.createdAt >= startedAt) : -1;
}
