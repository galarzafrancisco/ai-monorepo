import { ThreadAgentMessageKind } from '../thread-agent.enums';
import { renderTranscript } from './compaction.hook';
import { EasterEggHook } from './easter-egg.hook';
import { ThreadAgentHook } from './thread-agent-hook.interface';
import { ThreadAgentHooksRunner } from './thread-agent-hooks.runner';

jest.mock('../thread-agent-log.service', () => ({ ThreadAgentLogService: class {} }));
jest.mock('src/config/env.config', () => ({
  getConfig: () => ({ threadAgentCompactionTokenThreshold: 100 }),
}));

const turn = { threadId: 'thread-1', turnId: 'turn-1' };

describe('ThreadAgentHooksRunner', () => {
  const createRunner = (hooks: ThreadAgentHook[]) => {
    const agentLog = { append: jest.fn().mockResolvedValue([]) };
    return { agentLog, runner: new ThreadAgentHooksRunner(hooks, agentLog as never) };
  };

  it('stores what a hook returns as a hidden injection', async () => {
    const { runner, agentLog } = createRunner([
      { name: 'lookup', beforeTurn: async () => 'Existing tags:\n- bug' },
    ]);

    const injected = await runner.runBeforeTurn({ ...turn, newUserMessages: [], context: [] });

    expect(injected).toBe(true);
    expect(agentLog.append).toHaveBeenCalledWith('thread-1', [
      expect.objectContaining({
        kind: ThreadAgentMessageKind.INJECTION,
        source: 'hook:lookup',
        turnId: 'turn-1',
        message: {
          role: 'user',
          content: '<context source="lookup">\nExisting tags:\n- bug\n</context>',
        },
      }),
    ]);
  });

  it('keeps going when a hook throws or has nothing to add', async () => {
    const { runner, agentLog } = createRunner([
      { name: 'broken', beforeTurn: async () => { throw new Error('boom'); } },
      { name: 'quiet', beforeTurn: async () => null },
      { name: 'useful', beforeTurn: async () => 'context' },
    ]);

    const injected = await runner.runBeforeTurn({ ...turn, newUserMessages: [], context: [] });

    expect(injected).toBe(true);
    expect(agentLog.append).toHaveBeenCalledTimes(1);
  });
});

describe('EasterEggHook', () => {
  const hook = new EasterEggHook();

  it('hands over the countersign when the user says the recognition phrase', async () => {
    const text = await hook.beforeTurn({
      ...turn,
      newUserMessages: ['Psst. The key is under the doormat.'],
      context: [],
    });

    expect(text).toContain('The owl only hoots at midnight.');
  });

  it('stays quiet otherwise', async () => {
    expect(
      await hook.beforeTurn({ ...turn, newUserMessages: ['where is the key?'], context: [] }),
    ).toBeNull();
  });
});

describe('renderTranscript', () => {
  it('renders text, tool calls and tool results as plain text', () => {
    const transcript = renderTranscript([
      { role: 'user', content: 'list my tasks' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking.' },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'tasks__list', input: { q: 'mine' } },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'c1', toolName: 'tasks__list', output: { type: 'json', value: [] } },
        ],
      },
    ]);

    expect(transcript).toBe(
      [
        'user: list my tasks',
        'assistant: Checking.',
        'assistant called tasks__list: {"q":"mine"}',
        'tasks__list returned: {"type":"json","value":[]}',
      ].join('\n'),
    );
  });
});
