import { describe, expect, it } from 'vitest';
import { emptyActivity, liveEntryId, traceInsertionIndex, updateActivity } from './activityState';

const at = '2026-10-28T12:00:00.000Z';
const event = (kind: 'thinking' | 'tool_calling' | 'tool_result' | 'step_end' | 'turn_end', toolCallId?: string) =>
  ({ threadId: 'a', turnId: 'turn-a', kind, toolCallId, toolName: 'lookup' });

describe('thread activity lifecycle', () => {
  it('keeps a silent model step and a long-running tool live until explicit completion', () => {
    let state = updateActivity(emptyActivity, event('thinking'), at);
    expect(liveEntryId(state)).toBe(state.entries[0].id);
    state = updateActivity(state, event('tool_calling', 'one'), at);
    expect(liveEntryId(state)).toBe('tool:one');
    // No timer expires, even after a tool runs for longer than three seconds.
    expect(liveEntryId(state)).toBe('tool:one');
    state = updateActivity(state, event('tool_result', 'one'), '2026-10-28T12:01:00.000Z');
    expect(state.pendingTools).toEqual([]);
    state = updateActivity(state, event('step_end'), at);
    expect(liveEntryId(state)).toBeNull();
    expect(state.entries[1].status).toBe('Completed');
  });

  it('tracks parallel tools independently, including failure and turn completion', () => {
    let state = updateActivity(emptyActivity, event('thinking'), at);
    state = updateActivity(state, event('tool_calling', 'one'), at);
    state = updateActivity(state, event('tool_calling', 'two'), at);
    state = updateActivity(state, event('tool_result', 'two'), at);
    expect(liveEntryId(state)).toBe('tool:one');
    state = updateActivity(state, { ...event('tool_result', 'one'), failed: true }, at);
    expect(state.entries[1].status).toBe('Failed');
    state = updateActivity(state, event('turn_end'), at);
    expect(liveEntryId(state)).toBeNull();
    expect(state.entries).toHaveLength(3);
    state = updateActivity(state, { ...event('thinking'), turnId: 'turn-b' }, at);
    expect(state.entries).toHaveLength(1);
  });

  it('ignores empty turns and late completion from an older turn', () => {
    let state = updateActivity(emptyActivity, event('thinking'), at);
    state = updateActivity(state, event('turn_end'), at);
    expect(state.entries).toHaveLength(1);
    expect(updateActivity(state, { ...event('turn_end'), turnId: 'empty' }, at)).toBe(state);

    state = updateActivity(state, { ...event('thinking'), turnId: 'turn-b' }, at);
    expect(liveEntryId(state)).toBe(state.entries[0].id);
    expect(updateActivity(state, event('turn_end'), at)).toBe(state);
    expect(liveEntryId(state)).toBe(state.entries[0].id);
    expect(state.turnId).toBe('turn-b');
  });

  it('anchors the trace before the reply and subsequent user message', () => {
    const messages = [
      { createdAt: '2026-10-28T11:59:00.000Z' },
      { createdAt: '2026-10-28T12:01:00.000Z' },
      { createdAt: '2026-10-28T12:02:00.000Z' },
    ];
    expect(traceInsertionIndex(at, messages)).toBe(1);
    expect(traceInsertionIndex(at, messages.slice(0, 1))).toBe(-1);
    // A newly mounted chat for another thread begins with no trace.
    expect(traceInsertionIndex(emptyActivity.startedAt, messages)).toBe(-1);
    expect(emptyActivity.entries).toEqual([]);
  });
});
