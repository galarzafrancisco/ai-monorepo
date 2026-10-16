import { findRepeatedToolCall, isRepeatedToolCall, MAX_REPEATED_TOOL_CALLS } from './repeated-tool-call';

const call = (toolName: string, input: unknown = {}) => ({ toolCalls: [{ toolName, input }] });
const text = { toolCalls: [] };

describe('findRepeatedToolCall', () => {
  it('finds the same call made three steps in a row', () => {
    const steps = [call('tasks__get_all_tags'), call('tasks__get_all_tags'), call('tasks__get_all_tags')];

    expect(findRepeatedToolCall(steps)).toEqual({
      toolNames: ['tasks__get_all_tags'],
      times: MAX_REPEATED_TOOL_CALLS,
    });
    expect(isRepeatedToolCall()({ steps } as never)).toBe(true);
  });

  it('allows a call to be repeated twice', () => {
    expect(findRepeatedToolCall([call('get_time'), call('get_time')])).toBeNull();
  });

  it('allows the same tool with different input', () => {
    const steps = [
      call('tasks__fetch', { taskId: 'a' }),
      call('tasks__fetch', { taskId: 'b' }),
      call('tasks__fetch', { taskId: 'c' }),
    ];
    expect(findRepeatedToolCall(steps)).toBeNull();
  });

  it('only looks at the last steps', () => {
    const steps = [call('get_time'), call('get_time'), call('get_time'), call('remind', { in: '5m' })];
    expect(findRepeatedToolCall(steps)).toBeNull();
  });

  it('ignores steps that only produced text', () => {
    expect(findRepeatedToolCall([text, text, text])).toBeNull();
  });
});
