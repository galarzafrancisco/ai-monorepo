import { ThreadAgentMessageKind } from '../thread-agent.enums';
import { renderTranscript } from './compaction.hook';
import { TagsContextHook } from './tags-context.hook';
import { ThreadAgentHook } from './thread-agent-hook.interface';
import { ThreadAgentHooksRunner } from './thread-agent-hooks.runner';

jest.mock('src/meta/meta.service', () => ({ MetaService: class {} }));
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
      { name: 'tags', beforeTurn: async () => 'Existing tags:\n- bug' },
    ]);

    const injected = await runner.runBeforeTurn({ ...turn, newUserMessages: [], context: [] });

    expect(injected).toBe(true);
    expect(agentLog.append).toHaveBeenCalledWith('thread-1', [
      expect.objectContaining({
        kind: ThreadAgentMessageKind.INJECTION,
        source: 'hook:tags',
        turnId: 'turn-1',
        message: {
          role: 'user',
          content: '<context source="tags">\nExisting tags:\n- bug\n</context>',
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

describe('TagsContextHook', () => {
  const metaService = { getAllTags: jest.fn().mockResolvedValue([{ name: 'bug' }, { name: 'project:taico' }]) };
  const hook = new TagsContextHook(metaService as never);

  it('lists tags when the user talks about tags', async () => {
    const text = await hook.beforeTurn({
      ...turn,
      newUserMessages: ['add a tag to that task'],
      context: [],
    });

    expect(text).toBe('Existing tags:\n- bug\n- project:taico');
  });

  it('stays quiet for unrelated messages and when tags are already in context', async () => {
    expect(
      await hook.beforeTurn({ ...turn, newUserMessages: ['what is the status?'], context: [] }),
    ).toBeNull();

    expect(
      await hook.beforeTurn({
        ...turn,
        newUserMessages: ['tag it'],
        context: [
          { id: 'r1', source: 'hook:tags', message: {}, formatVersion: 1, providerType: null, modelId: null },
        ],
      }),
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
