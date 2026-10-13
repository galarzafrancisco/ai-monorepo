import { jsonSchema, simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import {
  MessageCreatedEvent,
  ThreadAgentResponseDeltaEvent,
  ThreadUpdatedEvent,
} from '../events/threads.events';
import { ThreadAgentService } from './thread-agent.service';
import { ThreadAgentMessageRole, ThreadTurnStatus } from './thread-agent.enums';

// Collaborators are replaced with fakes below; mocking the modules keeps their
// own dependency graphs out of this unit test.
jest.mock('src/agents/agents.service', () => ({ AgentsService: class {} }));
jest.mock('./chat-model.factory', () => ({ ChatModelFactory: class {} }));
jest.mock('./taico-mcp-tools.factory', () => ({ TaicoMcpToolsFactory: class {} }));
jest.mock('./thread-agent-tools.factory', () => ({ ThreadAgentToolsFactory: class {} }));
jest.mock('./thread-agent-log.service', () => ({ ThreadAgentLogService: class {} }));
jest.mock('./hooks/thread-agent-hooks.runner', () => ({ ThreadAgentHooksRunner: class {} }));

const THREAD_ID = 'thread-1';
const AGENT_ACTOR_ID = 'agent-actor';

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const finish = (unified: 'stop' | 'tool-calls') => ({
  type: 'finish' as const,
  finishReason: { unified, raw: undefined },
  usage,
});

const textStep = (text: string) => [
  { type: 'text-start' as const, id: 't' },
  { type: 'text-delta' as const, id: 't', delta: text },
  { type: 'text-end' as const, id: 't' },
  finish('stop'),
];

const toolCallStep = [
  { type: 'text-start' as const, id: 't' },
  { type: 'text-delta' as const, id: 't', delta: 'Let me check.' },
  { type: 'text-end' as const, id: 't' },
  { type: 'tool-call' as const, toolCallId: 'c1', toolName: 'tasks__fetch', input: '{"id":"1"}' },
  finish('tool-calls'),
];

const staySilentStep = [
  { type: 'tool-call' as const, toolCallId: 'c2', toolName: 'stay_silent', input: '{}' },
  finish('tool-calls'),
];

const USER = { id: 'user-1', slug: 'fran', type: 'human', displayName: 'Fran' };

function createHarness(steps: unknown[][]) {
  let call = 0;
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      prompts.push(options.prompt);
      const chunks = steps[call++];
      if (!chunks) {
        throw new Error('model unavailable');
      }
      return { stream: simulateReadableStream({ chunks: chunks as never[] }) };
    },
  });

  const appended: Array<{ id: string; role: string; message: unknown; providerType: unknown }> = [];
  const displayMessages: Array<{ id: string; content: string; agentMessageId: string | null }> = [];
  const emitted: Array<{ event: symbol; payload: unknown }> = [];
  const finished: Array<{ status: ThreadTurnStatus; error?: string }> = [];

  const agentLog = {
    ingestPending: jest.fn().mockResolvedValue({
      triggerActor: USER,
      newUserMessages: ['hello'],
    }),
    hasPending: jest.fn().mockResolvedValue(false),
    ingestTaskNotifications: jest
      .fn()
      .mockResolvedValue({ triggerActor: null, notifiedTaskIds: [] }),
    hasPendingTaskNotifications: jest.fn().mockResolvedValue(false),
    getOrCreateThreadSecret: jest.fn().mockResolvedValue('a1b2c3'),
    loadContext: jest.fn().mockResolvedValue([
      {
        id: 'm0',
        kind: 'message',
        source: 'user',
        message: { role: 'user', content: '[Fran @fran] says:\nhello' },
        formatVersion: 1,
        providerType: null,
        modelId: null,
      },
    ]),
    append: jest.fn(async (_threadId: string, drafts: Array<Record<string, unknown>>) =>
      drafts.map((draft) => {
        const row = { id: `agent-msg-${appended.length + 1}`, ...draft } as (typeof appended)[number];
        appended.push(row);
        return row;
      }),
    ),
  };

  const turns = {
    tryClaim: jest.fn().mockResolvedValue({ id: 'turn-1', threadId: THREAD_ID }),
    startHeartbeat: jest.fn().mockReturnValue(() => undefined),
    finish: jest.fn(async (_id: string, status: ThreadTurnStatus, error?: string) => {
      finished.push({ status, error });
    }),
  };

  const threadMessageRepository = {
    create: (input: Record<string, unknown>) => input,
    save: jest.fn(async (input: { content: string; agentMessageId: string | null }) => {
      const saved = { id: `display-${displayMessages.length + 1}`, ...input };
      displayMessages.push(saved);
      return saved;
    }),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      displayMessages.find((message) => message.id === where.id),
    ),
  };

  const mcpClose = jest.fn().mockResolvedValue(undefined);
  const hooks = {
    runBeforeTurn: jest.fn().mockResolvedValue(false),
    runAfterTurn: jest.fn().mockResolvedValue(undefined),
  };

  const mcpOpen = jest.fn().mockResolvedValue({
    tools: {
      tasks__fetch: {
        inputSchema: jsonSchema({ type: 'object', properties: { id: { type: 'string' } } }),
        execute: async () => ({ name: 'Ship it' }),
      },
    },
    close: mcpClose,
  });
  const threadTools = {
    build: jest.fn().mockReturnValue({
      stay_silent: {
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async () => 'Turn ended without a message.',
      },
    }),
  };

  const service = new ThreadAgentService(
    { findOne: jest.fn().mockResolvedValue({ id: THREAD_ID, aiProviderId: null, modelId: null }) } as never,
    threadMessageRepository as never,
    {
      getAgentBySlug: jest.fn().mockResolvedValue({
        actorId: AGENT_ACTOR_ID,
        slug: 'taico',
        name: 'Taico',
        systemPrompt: 'You are Taico.',
        modelId: 'mock-model-id',
      }),
    } as never,
    agentLog as never,
    turns as never,
    {
      resolve: jest.fn().mockResolvedValue({ model, providerType: 'mock', modelId: 'mock-model-id' }),
    } as never,
    { open: mcpOpen } as never,
    threadTools as never,
    hooks as never,
    { emit: (event: symbol, payload: unknown) => emitted.push({ event, payload }) } as never,
  );

  return { hooks, service, mcpOpen, threadTools, agentLog, turns, appended, displayMessages, emitted, finished, prompts, mcpClose };
}

describe('ThreadAgentService', () => {
  it('persists every step and links each visible message to its agent message', async () => {
    const h = createHarness([toolCallStep, textStep('All done.')]);

    await h.service.drain(THREAD_ID);

    expect(h.appended.map((row) => row.role)).toEqual([
      ThreadAgentMessageRole.ASSISTANT,
      ThreadAgentMessageRole.TOOL,
      ThreadAgentMessageRole.ASSISTANT,
    ]);
    expect(h.appended.every((row) => row.providerType === 'mock')).toBe(true);
    expect(h.displayMessages).toEqual([
      expect.objectContaining({ content: 'Let me check.', agentMessageId: 'agent-msg-1' }),
      expect.objectContaining({ content: 'All done.', agentMessageId: 'agent-msg-3' }),
    ]);
    expect(h.finished).toEqual([{ status: ThreadTurnStatus.COMPLETED, error: undefined }]);
    expect(h.mcpClose).toHaveBeenCalledTimes(1);
    expect(h.hooks.runBeforeTurn).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: THREAD_ID, newUserMessages: ['hello'] }),
    );
    expect(h.hooks.runAfterTurn).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: THREAD_ID, turnId: 'turn-1', lastInputTokens: 3 }),
    );

    const deltas = h.emitted.filter((e) => e.event === ThreadAgentResponseDeltaEvent.INTERNAL);
    expect(deltas).toHaveLength(2);
    expect(
      h.emitted.filter((e) => e.event === MessageCreatedEvent.INTERNAL),
    ).toHaveLength(2);
  });

  it('sends the stored conversation to the model', async () => {
    const h = createHarness([textStep('Hi.')]);

    await h.service.drain(THREAD_ID);

    expect(h.prompts[0]).toEqual([
      expect.objectContaining({ role: 'system' }),
      { role: 'user', content: [{ type: 'text', text: '[Fran @fran] says:\nhello' }] },
    ]);
  });

  it('does nothing when another turn is running on the thread', async () => {
    const h = createHarness([textStep('Hi.')]);
    h.turns.tryClaim.mockResolvedValue(null);

    await h.service.drain(THREAD_ID);

    expect(h.agentLog.ingestPending).not.toHaveBeenCalled();
    expect(h.displayMessages).toEqual([]);
  });

  it('runs another turn when a message arrived while the first one was running', async () => {
    const h = createHarness([textStep('First.'), textStep('Second.')]);
    h.agentLog.hasPending.mockResolvedValueOnce(true).mockResolvedValue(false);

    await h.service.drain(THREAD_ID);

    expect(h.turns.tryClaim).toHaveBeenCalledTimes(2);
    expect(h.displayMessages.map((m) => m.content)).toEqual(['First.', 'Second.']);
  });

  it('fails the turn and tells the user when the model call fails', async () => {
    const h = createHarness([]);

    await h.service.drain(THREAD_ID);

    expect(h.finished).toEqual([
      { status: ThreadTurnStatus.FAILED, error: expect.stringContaining('model unavailable') },
    ]);
    expect(h.displayMessages).toEqual([
      expect.objectContaining({
        content: expect.stringContaining('I encountered an error'),
        agentMessageId: null,
      }),
    ]);
    expect(h.mcpClose).toHaveBeenCalledTimes(1);
  });

  it('runs a turn for a task notification when there is no new user message', async () => {
    const h = createHarness([textStep('The holidays task is done.')]);
    h.agentLog.ingestPending.mockResolvedValue({ triggerActor: null, newUserMessages: [] });
    h.agentLog.ingestTaskNotifications.mockResolvedValue({
      triggerActor: USER,
      notifiedTaskIds: ['task-1'],
    });

    await h.service.drain(THREAD_ID);

    // The turn acts for whoever the agent subscribed for.
    expect(h.mcpOpen).toHaveBeenCalledWith(expect.objectContaining({ issuedBy: USER }));
    expect(h.threadTools.build).toHaveBeenCalledWith({
      threadId: THREAD_ID,
      agentActorId: AGENT_ACTOR_ID,
      forActorId: USER.id,
    });
    expect(h.displayMessages.map((m) => m.content)).toEqual(['The holidays task is done.']);
    expect(h.emitted.filter((e) => e.event === ThreadUpdatedEvent.INTERNAL)).toHaveLength(1);
    expect(h.finished).toEqual([{ status: ThreadTurnStatus.COMPLETED, error: undefined }]);
  });

  it('does not call the model when there is neither a message nor a notification', async () => {
    const h = createHarness([textStep('Hi.')]);
    h.agentLog.ingestPending.mockResolvedValue({ triggerActor: null, newUserMessages: [] });

    await h.service.drain(THREAD_ID);

    expect(h.prompts).toEqual([]);
    expect(h.displayMessages).toEqual([]);
    expect(h.finished).toEqual([{ status: ThreadTurnStatus.COMPLETED, error: undefined }]);
  });

  it('runs another turn when a task notification arrived while the first one was running', async () => {
    const h = createHarness([textStep('First.'), textStep('Second.')]);
    h.agentLog.hasPendingTaskNotifications.mockResolvedValueOnce(true).mockResolvedValue(false);

    await h.service.drain(THREAD_ID);

    expect(h.turns.tryClaim).toHaveBeenCalledTimes(2);
  });

  it('ends the turn without a message when the agent chooses to stay silent', async () => {
    // A second model call would fail: there is no second step.
    const h = createHarness([staySilentStep]);

    await h.service.drain(THREAD_ID);

    expect(h.prompts).toHaveLength(1);
    expect(h.displayMessages).toEqual([]);
    expect(h.appended.map((row) => row.role)).toEqual([
      ThreadAgentMessageRole.ASSISTANT,
      ThreadAgentMessageRole.TOOL,
    ]);
    expect(h.finished).toEqual([{ status: ThreadTurnStatus.COMPLETED, error: undefined }]);
  });
});
