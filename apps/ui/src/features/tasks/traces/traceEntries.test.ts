import { describe, expect, it } from 'vitest';
import {
  buildTraceEntries,
  mergeTraceEvents,
  type TraceEvent,
} from './traceEntries';
const event = (
  sequence: number,
  payload: unknown,
  harness = 'claude',
): TraceEvent => ({
  executionId: 'execution',
  sequence,
  harness,
  source: 'harness',
  runnerSessionId: null,
  emittedAt: '2026-10-27T02:00:00Z',
  receivedAt: '2026-10-27T02:00:01Z',
  payload: payload as TraceEvent['payload'],
});
describe('trace presentation', () => {
  it('replaces Claude token deltas with the final message, retaining every original event', () => {
    const events = [
      event(1, {
        type: 'stream_event',
        event: { type: 'message_start', message: { id: 'm1' } },
      }),
      event(2, {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
      }),
      event(3, {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' },
        },
      }),
      event(4, {
        type: 'assistant',
        message: { id: 'm1', content: [{ type: 'text', text: 'Hello world' }] },
      }),
    ];
    const entries = buildTraceEntries(events);
    expect(entries.filter((entry) => entry.kind === 'message')).toHaveLength(1);
    expect(entries.find((entry) => entry.kind === 'message')).toMatchObject({
      text: 'Hello world',
      events: events.slice(1),
    });
    expect(
      entries
        .flatMap((entry) => entry.events)
        .map((e) => e.sequence)
        .sort(),
    ).toEqual([1, 2, 3, 4]);
  });
  it('joins tool arguments and results without losing either raw event', () => {
    const events = [
      event(1, {
        type: 'assistant',
        message: {
          id: 'm1',
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Bash',
              input: { command: 'npm test' },
            },
          ],
        },
      }),
      event(2, {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't1',
              content: [{ type: 'text', text: 'Tests passed' }],
            },
          ],
        },
      }),
    ];
    const entry = buildTraceEntries(events)[0];
    expect(entry).toMatchObject({
      title: 'Bash',
      kind: 'tool',
      status: 'Completed',
      text: 'Tests passed',
      events,
    });
    expect(entry.input).toContain('npm test');
    expect(buildTraceEntries(events.slice(0, 1))[0].status).toBe('Running');
  });
  it('updates OpenCode tool snapshots rather than rendering duplicate rows', () => {
    const events = [
      event(
        1,
        {
          type: 'message.part.updated',
          properties: {
            part: {
              id: 'p1',
              type: 'tool',
              tool: 'shell',
              state: { status: 'running', input: { command: 'git diff' } },
            },
          },
        },
        'opencode',
      ),
      event(
        2,
        {
          type: 'message.part.updated',
          properties: {
            part: {
              id: 'p1',
              type: 'tool',
              tool: 'shell',
              state: {
                status: 'completed',
                input: { command: 'git diff' },
                output: 'diff --git a/file b/file',
              },
            },
          },
        },
        'opencode',
      ),
    ];
    expect(buildTraceEntries(events)).toHaveLength(1);
    expect(buildTraceEntries(events)[0]).toMatchObject({
      title: 'shell',
      status: 'completed',
      text: 'diff --git a/file b/file',
      events,
    });
  });
  it('joins Copilot message deltas and tool lifecycle events', () => {
    const events = [
      event(
        1,
        {
          type: 'assistant.message_delta',
          data: { messageId: 'm1', deltaContent: 'Hello' },
        },
        'githubcopilot',
      ),
      event(
        2,
        {
          type: 'assistant.message',
          data: { messageId: 'm1', content: 'Hello world' },
        },
        'githubcopilot',
      ),
      event(
        3,
        {
          type: 'tool.execution_start',
          data: {
            toolCallId: 't1',
            toolName: 'Read',
            arguments: { path: '/file' },
          },
        },
        'githubcopilot',
      ),
      event(
        4,
        {
          type: 'tool.execution_complete',
          data: {
            toolCallId: 't1',
            success: false,
            error: 'Permission denied',
          },
        },
        'githubcopilot',
      ),
    ];
    expect(buildTraceEntries(events)).toHaveLength(2);
    expect(buildTraceEntries(events)[0].text).toBe('Hello world');
    expect(buildTraceEntries(events)[1]).toMatchObject({
      status: 'Failed',
      title: 'Read',
      text: 'Permission denied',
    });
  });
  it('renders ADK tools and unknown event types while retaining raw data', () => {
    const events = [
      event(
        1,
        {
          id: 'm1',
          author: 'Agent',
          content: {
            parts: [
              { functionCall: { name: 'read_file', args: { path: '/file' } } },
            ],
          },
        },
        'adk',
      ),
      event(2, { type: 'future.sdk.event', extra: true }),
    ];
    expect(buildTraceEntries(events)[0]).toMatchObject({
      kind: 'tool',
      title: 'read_file',
      events: [events[0]],
    });
    expect(buildTraceEntries(events)[1]).toMatchObject({
      kind: 'system',
      events: [events[1]],
    });
  });
  it('deduplicates overlapping pages and orders late events by sequence', () => {
    const a = event(1, {}),
      b = event(2, {}),
      c = event(3, {});
    expect(mergeTraceEvents([b, c], [a, b])).toEqual([a, b, c]);
  });

  it('keeps interleaved Claude subagent streams separate', () => {
    const events = [
      event(1, {
        type: 'stream_event',
        event: { type: 'message_start', message: { id: 'main' } },
      }),
      event(2, {
        type: 'stream_event',
        parent_tool_use_id: 'agent-tool',
        event: { type: 'message_start', message: { id: 'child' } },
      }),
      event(3, {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Main' },
        },
      }),
      event(4, {
        type: 'stream_event',
        parent_tool_use_id: 'agent-tool',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Child' },
        },
      }),
      event(5, {
        type: 'assistant',
        message: {
          id: 'main',
          content: [{ type: 'text', text: 'Main complete' }],
        },
      }),
      event(6, {
        type: 'assistant',
        parent_tool_use_id: 'agent-tool',
        message: {
          id: 'child',
          content: [{ type: 'text', text: 'Child complete' }],
        },
      }),
    ];
    const messages = buildTraceEntries(events).filter(
      (entry) => entry.kind === 'message',
    );
    expect(messages.map((entry) => entry.text)).toEqual([
      'Main complete',
      'Child complete',
    ]);
    expect(messages[0].events.map((e) => e.sequence)).toEqual([3, 5]);
    expect(messages[1].events.map((e) => e.sequence)).toEqual([4, 6]);
  });
  it('reconciles Claude per-block assistant events with their stream block indexes', () => {
    const stream = (sequence: number, value: unknown) =>
      event(sequence, { type: 'stream_event', event: value });
    const final = (sequence: number, block: unknown) =>
      event(sequence, {
        type: 'assistant',
        uuid: `u${sequence}`,
        message: { id: 'm1', content: [block] },
      });
    const events = [
      stream(1, { type: 'message_start', message: { id: 'm1' } }),
      stream(2, {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking', thinking: '' },
      }),
      stream(3, {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'Reason' },
      }),
      final(4, { type: 'thinking', thinking: 'Reason complete' }),
      stream(5, { type: 'content_block_stop', index: 0 }),
      stream(6, {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'text', text: '' },
      }),
      stream(7, {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'text_delta', text: 'Hello' },
      }),
      final(8, { type: 'text', text: 'Hello complete' }),
      stream(9, {
        type: 'content_block_start',
        index: 2,
        content_block: { type: 'tool_use', id: 't1', name: 'Read', input: {} },
      }),
      stream(10, {
        type: 'content_block_delta',
        index: 2,
        delta: { type: 'input_json_delta', partial_json: '{"path":"/file"}' },
      }),
      final(11, {
        type: 'tool_use',
        id: 't1',
        name: 'Read',
        input: { path: '/file' },
      }),
      event(12, {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't1',
              content: 'file contents',
            },
          ],
        },
      }),
    ];
    const entries = buildTraceEntries(events).filter(
      (entry) => entry.kind !== 'system',
    );
    expect(entries.map((entry) => entry.kind)).toEqual([
      'thinking',
      'message',
      'tool',
    ]);
    expect(entries.map((entry) => entry.text)).toEqual([
      'Reason complete',
      'Hello complete',
      'file contents',
    ]);
    expect(entries[2]).toMatchObject({ title: 'Read', status: 'Completed' });
    expect(entries[2].input).toContain('/file');
    expect(entries[2].events.map((e) => e.sequence)).toEqual([9, 10, 11, 12]);
    // A page that starts mid-message still reconciles partial blocks with finals.
    const partial = buildTraceEntries(events.slice(6)).filter(
      (entry) => entry.kind !== 'system',
    );
    expect(partial.map((entry) => entry.text)).toEqual([
      'Hello complete',
      'file contents',
    ]);
  });

  it('keeps multiple non-streamed Claude blocks with a shared message ID', () => {
    const events = ['first', 'second'].map((text, i) =>
      event(i + 1, {
        type: 'assistant',
        uuid: `u${i}`,
        message: { id: 'same', content: [{ type: 'text', text }] },
      }),
    );
    expect(buildTraceEntries(events).map((entry) => entry.text)).toEqual([
      'first',
      'second',
    ]);
  });

  it('does not combine orphaned Claude deltas across message boundaries', () => {
    const events = [
      event(1, {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'earlier tail' },
        },
      }),
      event(2, { type: 'stream_event', event: { type: 'message_stop' } }),
      event(3, {
        type: 'stream_event',
        event: { type: 'message_start', message: { id: 'next' } },
      }),
      event(4, {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'next message' },
        },
      }),
    ];
    expect(
      buildTraceEntries(events)
        .filter((entry) => entry.kind === 'message')
        .map((entry) => entry.text),
    ).toEqual(['earlier tail', 'next message']);
  });

  it('pairs ADK function results with calls across different event IDs', () => {
    const events = [
      event(
        1,
        {
          id: 'call-event',
          content: {
            parts: [
              {
                functionCall: {
                  id: 'call-1',
                  name: 'read_file',
                  args: { path: '/file' },
                },
              },
            ],
          },
        },
        'adk',
      ),
      event(
        2,
        {
          id: 'result-event',
          content: {
            parts: [
              {
                functionResponse: {
                  id: 'call-1',
                  name: 'read_file',
                  response: { text: 'result' },
                },
              },
            ],
          },
        },
        'adk',
      ),
    ];
    const entries = buildTraceEntries(events);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'tool',
      title: 'read_file',
      status: 'Completed',
      events,
    });
    expect(entries[0].input).toContain('/file');
    expect(entries[0].text).toContain('result');
  });
});
