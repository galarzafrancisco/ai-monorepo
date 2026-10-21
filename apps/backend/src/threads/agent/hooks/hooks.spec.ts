import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import {
  THREAD_AGENT_MESSAGE_FORMAT_VERSION,
  ThreadAgentMessageKind,
} from '../thread-agent.enums';
import { CompactionHook, renderTranscript } from './compaction.hook';
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

describe('CompactionHook', () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  };
  const finish = { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage };

  const row = {
    id: 'row-1',
    kind: ThreadAgentMessageKind.MESSAGE,
    source: 'user',
    message: { role: 'user', content: 'Please plan the release.' },
    formatVersion: THREAD_AGENT_MESSAGE_FORMAT_VERSION,
    providerType: null,
    modelId: null,
  };

  const setup = (options: {
    requiresStreaming?: boolean;
    streamChunks?: unknown[];
    streamError?: Error;
    generateError?: Error;
  }) => {
    const doGenerate = jest.fn(async () => {
      if (options.generateError) {
        throw options.generateError;
      }
      return {
        content: [{ type: 'text' as const, text: ' Generated summary ' }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage,
        warnings: [],
      };
    });
    const doStream = jest.fn(async () => {
      if (options.streamError) {
        throw options.streamError;
      }
      return {
        stream: simulateReadableStream({
          chunks: (options.streamChunks ?? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: ' Streamed ' },
            { type: 'text-delta', id: 't', delta: 'summary ' },
            { type: 'text-end', id: 't' },
            finish,
          ]) as never[],
        }),
      };
    });
    const model = new MockLanguageModelV4({ doGenerate, doStream });
    const agentLog = {
      loadContext: jest.fn().mockResolvedValue([row]),
      append: jest.fn().mockResolvedValue([]),
    };
    const hook = new CompactionHook(agentLog as never);
    const run = () =>
      hook.afterTurn({
        ...turn,
        lastInputTokens: 500,
        model: {
          model,
          providerType: 'mock',
          modelId: 'mock-model',
          requiresStreaming: options.requiresStreaming,
        },
      });
    return { run, agentLog, doGenerate, doStream };
  };

  const storedSummary = (agentLog: { append: jest.Mock }) =>
    agentLog.append.mock.calls[0][1][0].message.content as string;

  it('summarizes with one non-streaming call on an ordinary model', async () => {
    const { run, agentLog, doGenerate, doStream } = setup({});

    await run();

    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
    expect(agentLog.append).toHaveBeenCalledTimes(1);
    expect(agentLog.append.mock.calls[0][1][0]).toMatchObject({
      kind: ThreadAgentMessageKind.SUMMARY,
      source: 'compaction',
      turnId: 'turn-1',
    });
    expect(storedSummary(agentLog)).toContain('Generated summary');
  });

  it('streams and reads to the end on a model that requires streaming', async () => {
    const { run, agentLog, doGenerate, doStream } = setup({ requiresStreaming: true });

    await run();

    expect(doStream).toHaveBeenCalledTimes(1);
    expect(doGenerate).not.toHaveBeenCalled();
    expect(agentLog.append).toHaveBeenCalledTimes(1);
    expect(storedSummary(agentLog)).toContain('Streamed summary');
  });

  it('stores nothing when the stream reports an error after some text', async () => {
    const failure = new Error('response failed: usage limit');
    const { run, agentLog } = setup({
      requiresStreaming: true,
      streamChunks: [
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'Half a summ' },
        { type: 'error', error: failure },
      ],
    });

    await expect(run()).rejects.toBe(failure);
    expect(agentLog.append).not.toHaveBeenCalled();
  });

  it('stores nothing when the streamed request itself fails', async () => {
    const failure = new Error('stream ended before completion');
    const { run, agentLog } = setup({ requiresStreaming: true, streamError: failure });

    await expect(run()).rejects.toBe(failure);
    expect(agentLog.append).not.toHaveBeenCalled();
  });

  it('stores nothing when the non-streaming call fails', async () => {
    const failure = new Error('provider down');
    const { run, agentLog, doStream } = setup({ generateError: failure });

    await expect(run()).rejects.toThrow('provider down');
    expect(doStream).not.toHaveBeenCalled();
    expect(agentLog.append).not.toHaveBeenCalled();
  });

  it('does nothing while the conversation is under the threshold', async () => {
    const { agentLog, doGenerate, doStream } = setup({});
    const hook = new CompactionHook(agentLog as never);

    await hook.afterTurn({
      ...turn,
      lastInputTokens: 50,
      model: { model: new MockLanguageModelV4({ doGenerate, doStream }), providerType: 'mock', modelId: 'm' },
    });

    expect(agentLog.loadContext).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
  });
});
