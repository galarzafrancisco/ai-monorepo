import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { jsonSchema, tool } from 'ai';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { AiSdkBackend } from './ai-sdk.backend';
import { StreamMessageArgs } from './chat-backend.interface';
import { ChatProviderType } from 'src/chat-providers/enums';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const finish = (reason: 'stop' | 'tool-calls'): LanguageModelV4StreamPart => ({
  type: 'finish', finishReason: { unified: reason, raw: reason }, usage,
});
const textStream = (text: string): LanguageModelV4StreamPart[] => [
  { type: 'text-start', id: 'text' },
  { type: 'text-delta', id: 'text', delta: text },
  { type: 'text-end', id: 'text' },
  finish('stop'),
];
const args = {
  threadId: 'thread-1', conversationId: 'legacy-session', messageId: 'current-message',
  message: 'Help me', actor: { slug: 'alice', displayName: 'Alice' },
  agentName: 'Taico', systemPrompt: 'Be helpful', modelId: null, token: 'scoped-token',
} as StreamMessageArgs;
const collect = async <T>(events: AsyncIterable<T>): Promise<T[]> => {
  const result: T[] = [];
  for await (const event of events) result.push(event);
  return result;
};

describe('AiSdkBackend', () => {
  function setup(model?: MockLanguageModelV4) {
    let stored: any = null;
    const history = {
      findOneBy: jest.fn(async () => stored),
      save: jest.fn(async (value) => { stored = structuredClone(value); return value; }),
    };
    const transcript = { find: jest.fn().mockResolvedValue([]) };
    const close = jest.fn().mockResolvedValue(undefined);
    const mcp = { createTools: jest.fn().mockResolvedValue({ tools: {}, close }) };
    const providers = { getActiveChatProviderConfig: jest.fn().mockResolvedValue({
      type: ChatProviderType.OPENAI, apiKey: 'test-key',
    }) };
    const backend = new AiSdkBackend(providers as any, mcp as any, history as any, transcript as any);
    if (model) jest.spyOn(backend as any, 'getModel').mockResolvedValue(model);
    return { backend, history, transcript, mcp, close, providers };
  }

  it('uses the configured OpenAI, Google, and Vertex model adapters without global SDK state', async () => {
    const { backend, providers } = setup();
    const env = { ...process.env };
    try {
      expect(await (backend as any).getModel('custom-openai')).toMatchObject({
        modelId: 'custom-openai', provider: 'openai.responses',
      });
      providers.getActiveChatProviderConfig.mockResolvedValue({ type: ChatProviderType.ADK, apiKey: null } as any);
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
      expect(await (backend as any).getModel('custom-google')).toMatchObject({
        modelId: 'custom-google', provider: 'google.generative-ai',
      });
      process.env.GOOGLE_GENAI_USE_VERTEXAI = 'True';
      process.env.GOOGLE_CLOUD_PROJECT = 'project';
      process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
      expect(await (backend as any).getModel('custom-vertex')).toMatchObject({
        modelId: 'custom-vertex', provider: 'google.vertex.chat',
      });
    } finally { process.env = env; }
  });

  it('streams reasoning and tool activity, executes tools, and persists all steps for the next turn', async () => {
    const model = new MockLanguageModelV4({ doStream: [
      { stream: simulateReadableStream({ chunks: [
        { type: 'reasoning-start', id: 'reasoning' },
        { type: 'reasoning-delta', id: 'reasoning', delta: 'Thinking' },
        { type: 'reasoning-end', id: 'reasoning' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'tasks__fetch', input: '{"id":"task-1"}' },
        finish('tool-calls'),
      ] as LanguageModelV4StreamPart[] }) },
      { stream: simulateReadableStream({ chunks: textStream('Done') }) },
      { stream: simulateReadableStream({ chunks: textStream('Follow up') }) },
    ] });
    const { backend, history, mcp, close } = setup(model);
    const execute = jest.fn().mockResolvedValue({ name: 'Task one' });
    mcp.createTools.mockResolvedValue({ tools: {
      tasks__fetch: tool({ inputSchema: jsonSchema<{ id: string }>({
        type: 'object', properties: { id: { type: 'string' } }, required: ['id'],
      }), execute }),
    }, close } as any);
    expect(await collect(backend.streamMessage(args))).toEqual([
      { type: 'agent_activity', kind: 'thinking' },
      { type: 'agent_activity', kind: 'tool_calling' },
      { type: 'response_delta', delta: 'Done' },
      { type: 'final_response', content: 'Done' },
    ]);
    expect(execute).toHaveBeenCalledWith({ id: 'task-1' }, expect.anything());
    expect(history.save.mock.lastCall?.[0].messages.some((message: any) => message.role === 'tool')).toBe(true);
    await collect(backend.streamMessage({ ...args, message: 'What next?' }));
    expect(model.doStreamCalls[2].prompt.some((message) => message.role === 'tool')).toBe(true);
    expect(model.doStreamCalls[2].prompt.filter((message) => message.role === 'user')).toHaveLength(2);
    expect(close).toHaveBeenCalledTimes(2);
    expect(mcp.createTools).toHaveBeenCalledWith('scoped-token');
  });

  it('bootstraps old conversations without duplicating the current or later messages', async () => {
    const model = new MockLanguageModelV4({ doStream: { stream: simulateReadableStream({ chunks: textStream('Hello') }) } });
    const { backend, transcript } = setup(model);
    transcript.find.mockResolvedValue([
      { id: 'old-user', content: 'Earlier question', createdByActor: args.actor },
      { id: 'old-agent', content: 'Earlier answer', createdByActor: { slug: 'taico' } },
      { id: args.messageId, content: args.message, createdByActor: args.actor },
      { id: 'later', content: 'Later question', createdByActor: args.actor },
    ]);
    await collect(backend.streamMessage(args));
    expect(model.doStreamCalls[0].prompt.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain('Later question');
  });

  it('reports stream errors, retains the request, and closes MCP clients', async () => {
    const error = new Error('Provider failed');
    const model = new MockLanguageModelV4({ doStream: { stream: simulateReadableStream({ chunks: [
      { type: 'error', error },
    ] }) } });
    const { backend, history, close } = setup(model);
    expect(await collect(backend.streamMessage(args))).toEqual([{ type: 'error', error }]);
    expect(history.save.mock.lastCall?.[0].messages).toEqual([
      { role: 'user', content: '[Alice @alice] says:\nHelp me' },
    ]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('runs middle-manager tool side effects through the SDK loop and closes clients', async () => {
    const execute = jest.fn().mockResolvedValue('updated');
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: 'tool-call', toolCallId: 'update', toolName: 'context__update_block', input: '{}' }],
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage, warnings: [] },
      { content: [{ type: 'text', text: '' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] },
    ] });
    const { backend, mcp, close, history } = setup(model);
    mcp.createTools.mockResolvedValue({ tools: {
      context__update_block: tool({ inputSchema: jsonSchema({ type: 'object', properties: {} }), execute }),
    }, close } as any);
    await backend.runTask({ instructions: 'Update memory', prompt: 'New decision', token: 'scoped-token', modelId: null });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(history.save).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes MCP clients when a middle-manager run fails', async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('Invalid request'); } });
    const { backend, close } = setup(model);
    await expect(backend.runTask({ instructions: '', prompt: '', token: 'token', modelId: null })).rejects.toThrow('Invalid request');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent turns and retains both in history', async () => {
    const model = new MockLanguageModelV4({ doStream: () => Promise.resolve({ stream: simulateReadableStream({ chunks: textStream('Answer') }) }) });
    const { backend, history } = setup(model);
    await Promise.all([
      collect(backend.streamMessage(args)),
      collect(backend.streamMessage({ ...args, message: 'Second question' })),
    ]);
    expect(model.doStreamCalls[1].prompt.filter((message) => message.role === 'user')).toHaveLength(2);
    expect(history.save.mock.lastCall?.[0].messages.filter((message: any) => message.role === 'user')).toHaveLength(2);
  });

  it('aborts the SDK run and closes MCP clients when the consumer cancels the stream', async () => {
    const model = new MockLanguageModelV4({ doStream: { stream: simulateReadableStream({ chunks: textStream('Answer') }) } });
    const { backend, close } = setup(model);
    const stream = backend.streamMessage(args);
    expect((await stream.next()).value).toEqual({ type: 'response_delta', delta: 'Answer' });
    await stream.return(undefined);
    expect(model.doStreamCalls[0].abortSignal?.aborted).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('generates tool-free text for titles and returns null on failure', async () => {
    const model = new MockLanguageModelV4({ doGenerate: { content: [{ type: 'text', text: ' Title ' }],
      finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] } });
    const { backend, mcp } = setup(model);
    expect(await backend.generateText('Make a title', null)).toBe('Title');
    expect(mcp.createTools).not.toHaveBeenCalled();
    model.doGenerate = async () => { throw new Error('Invalid request'); };
    expect(await backend.generateText('Make a title', null)).toBeNull();
  });
});
