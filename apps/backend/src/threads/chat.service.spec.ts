import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AiModelJob } from 'src/ai-providers/enums';
import {
  AiModelNotSelectedError,
  AiProviderConnectionConsentRequiredError,
  AiProviderConnectionRequiredError,
  AiProviderRequestFailedError,
} from 'src/ai-providers/errors/ai-providers.errors';
import { ChatService } from './chat.service';

// The errors package is ESM, which this Jest setup does not load. Codes equal their names.
jest.mock('@taico/errors', () => ({
  ErrorCodes: new Proxy({}, { get: (_target, name) => name }),
}));
jest.mock('src/agents/agents.service', () => ({ AgentsService: class {} }));
jest.mock('./agent/chat-model.factory', () => ({ ChatModelFactory: class {} }));
jest.mock('./agent/taico-mcp-tools.factory', () => ({ TaicoMcpToolsFactory: class {} }));
jest.mock('./agent/thread-agent.service', () => ({
  THREAD_AGENT_MAX_STEPS: 5,
  THREAD_AGENT_SLUG: 'taico',
}));

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const finish = {
  type: 'finish' as const,
  finishReason: { unified: 'stop' as const, raw: undefined },
  usage,
};
const textChunks = (...deltas: string[]) => [
  { type: 'text-start', id: 't' },
  ...deltas.map((delta) => ({ type: 'text-delta', id: 't', delta })),
  { type: 'text-end', id: 't' },
];

describe('ChatService.generateText (small tasks)', () => {
  const setup = (options: {
    requiresStreaming?: boolean;
    streamChunks?: unknown[];
    resolveError?: Error;
  }) => {
    const doGenerate = jest.fn(async () => ({
      content: [{ type: 'text' as const, text: ' Generated title ' }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage,
      warnings: [],
    }));
    const doStream = jest.fn(async () => ({
      stream: simulateReadableStream({
        chunks: (options.streamChunks ?? [...textChunks(' Streamed ', 'title '), finish]) as never[],
      }),
    }));
    const model = new MockLanguageModelV4({ doGenerate, doStream });
    const resolve = jest.fn(async () => {
      if (options.resolveError) {
        throw options.resolveError;
      }
      return {
        model,
        providerType: 'mock',
        modelId: 'mock-model',
        requiresStreaming: options.requiresStreaming,
      };
    });
    const service = new ChatService(
      {} as never,
      { resolve } as never,
      {} as never,
    );
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    const debug = jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
    return { service, resolve, doGenerate, doStream, warn, debug };
  };

  const author = { actorId: 'author-1', automated: false as const };
  const asUser = { job: AiModelJob.USER_SMALL_TASKS as const, onBehalfOf: author };
  const asSystem = { job: AiModelJob.SYSTEM_SMALL_TASKS as const };

  it('asks for the user small tasks model on behalf of the person who started the call', async () => {
    const { service, resolve } = setup({});

    await service.generateText('Name this', asUser);

    expect(resolve).toHaveBeenCalledWith({
      job: AiModelJob.USER_SMALL_TASKS,
      onBehalfOf: author,
    });
  });

  it('asks for the system small tasks model without naming anyone', async () => {
    const { service, resolve } = setup({});

    await service.generateText('Name this', asSystem);

    expect(resolve).toHaveBeenCalledWith({ job: AiModelJob.SYSTEM_SMALL_TASKS });
  });

  it('keeps a single non-streaming call on an ordinary provider', async () => {
    const { service, doGenerate, doStream } = setup({});

    await expect(service.generateText('Name this', asSystem)).resolves.toBe('Generated title');
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream).not.toHaveBeenCalled();
  });

  it('streams and reads to the end on a provider that only streams', async () => {
    const { service, doGenerate, doStream } = setup({ requiresStreaming: true });

    await expect(
      service.generateText('Name this', asUser),
    ).resolves.toBe('Streamed title');
    expect(doStream).toHaveBeenCalledTimes(1);
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it('returns nothing when the stream fails after some text', async () => {
    const failure = new AiProviderRequestFailedError('The ChatGPT plan request failed.', {
      upstreamCode: 'subscription_sharing_usage_limit_exceeded',
    });
    const { service, doGenerate, warn } = setup({
      requiresStreaming: true,
      streamChunks: [...textChunks('Half a'), { type: 'error', error: failure }, finish],
    });

    await expect(
      service.generateText('Name this', asUser),
    ).resolves.toBeNull();
    expect(doGenerate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Text generation failed',
        job: AiModelJob.USER_SMALL_TASKS,
        onBehalfOf: author,
        error: expect.objectContaining({
          code: 'AI_PROVIDER_REQUEST_FAILED',
          upstreamCode: 'subscription_sharing_usage_limit_exceeded',
        }),
      }),
    );
  });

  it.each([
    ['not connected', new AiProviderConnectionRequiredError('p', 'not connected')],
    ['no consent', new AiProviderConnectionConsentRequiredError('p', 'no consent')],
  ])('returns nothing and logs why when %s, calling no model', async (_label, error) => {
    const { service, doGenerate, doStream, warn } = setup({ resolveError: error });

    await expect(
      service.generateText('Name this', asUser),
    ).resolves.toBeNull();
    expect(doGenerate).not.toHaveBeenCalled();
    expect(doStream).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: (error as { code: string }).code }),
      }),
    );
  });

  it('logs quietly when user small tasks have no model, which is a choice', async () => {
    const { service, warn, debug } = setup({
      resolveError: new AiModelNotSelectedError(AiModelJob.USER_SMALL_TASKS),
    });

    await expect(service.generateText('Name this', asUser)).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalled();
  });

  it('warns with setup guidance when system small tasks have no model', async () => {
    const { service, warn, doGenerate, doStream } = setup({
      resolveError: new AiModelNotSelectedError(AiModelJob.SYSTEM_SMALL_TASKS),
    });

    await expect(service.generateText('Name this', asSystem)).resolves.toBeNull();
    expect(doGenerate).not.toHaveBeenCalled();
    expect(doStream).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        job: AiModelJob.SYSTEM_SMALL_TASKS,
        onBehalfOf: undefined,
        error: expect.objectContaining({
          code: 'AI_MODEL_NOT_SELECTED',
          message: expect.stringContaining('provider with an API key'),
        }),
      }),
    );
  });
});
