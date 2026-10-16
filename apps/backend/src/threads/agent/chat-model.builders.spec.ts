import { jsonSchema, streamText, tool } from 'ai';
import { AiProviderType } from 'src/ai-providers/enums';
import { ApiKeyProviderType, createChatModel } from './chat-model.builders';

// @taico/errors ships ESM that Jest doesn't transform; the other specs here mock it the same way.
jest.mock('src/ai-providers/errors/ai-providers.errors', () => ({
  AiProviderNotConfiguredError: class extends Error {},
}));

type WireBody = Record<string, unknown> & {
  tools?: Array<{ type: string; name: string; tools?: Array<{ name: string }> }>;
};

const config = (type: ApiKeyProviderType) => ({
  id: 'provider-1',
  type,
  apiKey: 'test-key',
  baseUrl: null,
  project: null,
  location: null,
});

const noInput = jsonSchema<Record<string, never>>({ type: 'object', properties: {} });

/** Streams one request through the model and returns the body it sent, via the injected fetch. */
async function captureBody(type: ApiKeyProviderType, modelId: string): Promise<WireBody> {
  const bodies: WireBody[] = [];
  const fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(init?.body as string));
    return new Response('{"error":{"message":"stop here"}}', { status: 400 });
  }) as unknown as typeof globalThis.fetch;

  const resolved = createChatModel(config(type), modelId, { fetch });
  const result = streamText({
    model: resolved.model,
    prompt: 'what time is it?',
    tools: {
      tasks__get_all_tags: tool({ description: 'List all tags', inputSchema: noInput }),
      get_time: tool({ description: 'Get the current time', inputSchema: noInput }),
    },
    providerOptions: resolved.providerOptions,
    maxRetries: 0,
    onError: () => undefined,
  });
  await result.consumeStream();

  expect(fetch).toHaveBeenCalledTimes(1);
  return bodies[0];
}

describe('createChatModel', () => {
  it('wraps OpenAI with tool namespaces and asks it not to store responses', async () => {
    const resolved = createChatModel(config(AiProviderType.OPENAI), 'gpt-test');
    expect(resolved).toMatchObject({
      providerType: AiProviderType.OPENAI,
      modelId: 'gpt-test',
      providerOptions: { openai: { store: false } },
    });

    const body = await captureBody(AiProviderType.OPENAI, 'gpt-test');

    expect(body.store).toBe(false);
    expect(body.tools?.map((ns) => [ns.type, ns.name, ns.tools?.map((t) => t.name)])).toEqual([
      ['namespace', 'tasks', ['tasks__get_all_tags']],
      ['namespace', 'taico', ['get_time']],
    ]);
  });

  it('sends Anthropic a plain, flat tool list', async () => {
    const resolved = createChatModel(config(AiProviderType.ANTHROPIC), 'claude-test');
    expect(resolved.providerOptions).toBeUndefined();
    expect(resolved.requiresStreaming).toBeUndefined();

    const body = await captureBody(AiProviderType.ANTHROPIC, 'claude-test');

    expect(body.tools?.map((t) => t.name)).toEqual(['tasks__get_all_tags', 'get_time']);
  });

  it('sends Google a plain model with no provider options', async () => {
    const resolved = createChatModel(config(AiProviderType.GOOGLE), 'gemini-test');
    expect(resolved).toMatchObject({ providerType: AiProviderType.GOOGLE, modelId: 'gemini-test' });
    expect(resolved.providerOptions).toBeUndefined();

    const body = await captureBody(AiProviderType.GOOGLE, 'gemini-test');

    const declarations = (body.tools as unknown as Array<{ functionDeclarations: Array<{ name: string }> }>)
      .flatMap((t) => t.functionDeclarations)
      .map((d) => d.name);
    expect(declarations).toEqual(['tasks__get_all_tags', 'get_time']);
  });

  it('refuses an OpenAI-compatible provider without a base URL', () => {
    expect(() => createChatModel(config(AiProviderType.OPENAI_COMPATIBLE), 'any')).toThrow();
  });
});
