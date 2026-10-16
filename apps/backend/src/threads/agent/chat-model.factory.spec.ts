import { generateText, jsonSchema, tool } from 'ai';
import { AiModelJob, AiProviderType } from 'src/ai-providers/enums';
import { ChatModelFactory } from './chat-model.factory';

jest.mock('src/ai-providers/ai-providers.service', () => ({ AiProvidersService: class {} }));
jest.mock('src/ai-providers/ai-model-selections.service', () => ({
  AiModelSelectionsService: class {},
}));
jest.mock('src/ai-providers/errors/ai-providers.errors', () => ({
  AiProviderNotConfiguredError: class extends Error {},
  AiProviderJobNotAllowedError: class extends Error {
    readonly code = 'AI_PROVIDER_JOB_NOT_ALLOWED';
  },
}));
jest.mock('src/ai-providers/chatgpt-subscription/chatgpt-subscription.service', () => ({
  ChatgptSubscriptionService: class {},
}));

const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_LOCATION',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
];

describe('ChatModelFactory', () => {
  const originalEnv = { ...process.env };

  const providerConfig = (type: AiProviderType, apiKey: string | null = null) => ({
    id: 'provider-1',
    type,
    apiKey,
    baseUrl: null,
    project: null,
    location: null,
  });

  const factoryFor = (type: AiProviderType, selectedModelId: string, apiKey: string | null = null) => {
    const resolveSelection = jest.fn(async () => ({
      provider: providerConfig(type, apiKey),
      modelId: selectedModelId,
    }));
    const getAiProviderConfigById = jest.fn(async () => providerConfig(type));
    const modelForTurn = jest.fn(async () => ({ modelId: 'plan-model' }));
    const factory = new ChatModelFactory(
      { getAiProviderConfigById } as never,
      { resolve: resolveSelection } as never,
      { modelForTurn } as never,
    );
    return { factory, resolveSelection, getAiProviderConfigById, modelForTurn };
  };

  beforeEach(() => {
    for (const key of GOOGLE_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses Vertex AI from the environment when nothing is stored on the provider', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';

    const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash');
    const resolved = await factory.resolve({ job: AiModelJob.CONVERSATION });

    expect(resolved).toMatchObject({
      providerType: AiProviderType.GOOGLE_VERTEX,
      modelId: 'gemini-3.6-flash',
    });
  });

  it('runs a Gemini model on Vertex AI through the Gemini API', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';

    const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash');
    const resolved = await factory.resolve({
      job: AiModelJob.CONVERSATION,
      aiProviderId: 'provider-1',
      modelId: 'gemini-3.6-flash',
    });

    const model = resolved.model as { provider: string };
    expect(model.provider).toMatch(/vertex/i);
    expect(model.provider).not.toMatch(/anthropic/i);
  });

  it.each(['claude-sonnet-4-5', 'claude-opus-4-1@20250805'])(
    'runs %s on Vertex AI through the Anthropic API',
    async (modelId) => {
      process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'us-east5';

      const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, modelId);
      const resolved = await factory.resolve({ job: AiModelJob.CONVERSATION });

      expect(resolved).toMatchObject({ providerType: AiProviderType.GOOGLE_VERTEX, modelId });
      expect((resolved.model as { provider: string }).provider).toBe('googleVertex.anthropic.messages');
      expect((resolved.model as { modelId: string }).modelId).toBe(modelId);
    },
  );

  // A model that saw ~50 tools in one list missed the last ones (get_time,
  // stay_silent). Every provider gets thread tools first; OpenAI also gets
  // one namespace per group.
  describe('tool namespaces', () => {
    const noInput = jsonSchema<Record<string, never>>({ type: 'object', properties: {} });
    const stub = () => tool({ description: 'stub', inputSchema: noInput, execute: async () => 'ok' });
    const tools = {
      tasks__get_all_tags: stub(),
      context__get_all_tags: stub(),
      get_time: stub(),
      stay_silent: stub(),
    };

    const requestBodyFor = async (type: AiProviderType, modelId: string) => {
      const bodies: Array<Record<string, any>> = [];
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (_url, init) => {
          bodies.push(JSON.parse(String(init?.body)));
          return new Response('{"error":{"message":"stop here"}}', { status: 400 });
        });
      try {
        const { factory } = factoryFor(type, modelId, 'test-key');
        const resolved = await factory.resolve({ job: AiModelJob.CONVERSATION });
        await generateText({ model: resolved.model, tools, prompt: 'time?', maxRetries: 0 }).catch(
          () => undefined,
        );
      } finally {
        fetchSpy.mockRestore();
      }
      return bodies[0];
    };

    it('sends OpenAI API-key models their tools in namespaces, thread tools first', async () => {
      const body = await requestBodyFor(AiProviderType.OPENAI, 'gpt-6');

      expect(
        body.tools.map((ns: { type: string; name: string; tools: Array<{ name: string }> }) => [
          ns.type,
          ns.name,
          ns.tools.map((t) => t.name),
        ]),
      ).toEqual([
        ['namespace', 'taico', ['get_time', 'stay_silent']],
        ['namespace', 'tasks', ['tasks__get_all_tags']],
        ['namespace', 'context', ['context__get_all_tags']],
      ]);
    });

    it('sends other providers their tools with thread tools first', async () => {
      const body = await requestBodyFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

      expect(body.tools.map((t: { name: string }) => t.name)).toEqual([
        'get_time',
        'stay_silent',
        'tasks__get_all_tags',
        'context__get_all_tags',
      ]);
    });
  });

  it('builds an xAI model for a Grok provider', async () => {
    const { factory } = factoryFor(AiProviderType.XAI, 'grok-4');

    const resolved = await factory.resolve({ job: AiModelJob.CONVERSATION });

    expect(resolved).toMatchObject({ providerType: AiProviderType.XAI, modelId: 'grok-4' });
    expect((resolved.model as { provider: string }).provider).toContain('xai');
  });

  it("asks for the job's selection when the thread has no model of its own", async () => {
    const { factory, resolveSelection } = factoryFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

    const resolved = await factory.resolve({ job: AiModelJob.SYSTEM_SMALL_TASKS });

    expect(resolveSelection).toHaveBeenCalledWith(AiModelJob.SYSTEM_SMALL_TASKS);
    expect(resolved.modelId).toBe('claude-haiku-5-5');
  });

  it.each([AiModelJob.USER_SMALL_TASKS, AiModelJob.SYSTEM_SMALL_TASKS])(
    'runs %s on a provider with an API key, with or without a person',
    async (job) => {
      const { factory } = factoryFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

      await expect(factory.resolve({ job })).resolves.toMatchObject({
        providerType: AiProviderType.ANTHROPIC,
      });
      await expect(
        factory.resolve({ job, onBehalfOf: { actorId: 'actor-1', automated: false } }),
      ).resolves.toMatchObject({ providerType: AiProviderType.ANTHROPIC });
    },
  );

  it("uses the thread's own provider and model when both are set", async () => {
    const { factory, resolveSelection, getAiProviderConfigById } = factoryFor(
      AiProviderType.ANTHROPIC,
      'claude-haiku-5-5',
    );

    const resolved = await factory.resolve({
      job: AiModelJob.CONVERSATION,
      aiProviderId: 'provider-1',
      modelId: 'claude-opus-5-5',
    });

    expect(getAiProviderConfigById).toHaveBeenCalledWith('provider-1');
    expect(resolveSelection).not.toHaveBeenCalled();
    expect(resolved.modelId).toBe('claude-opus-5-5');
  });

  describe('a provider that runs on a person\u2019s own plan', () => {
    const onBehalfOf = { actorId: 'actor-1', automated: false };

    it('binds a thread turn to the person it is for and marks the model streaming-only', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-large',
      );

      const resolved = await factory.resolve({ job: AiModelJob.CONVERSATION, onBehalfOf });

      expect(modelForTurn).toHaveBeenCalledWith({
        providerId: 'provider-1',
        modelId: 'gpt-plan-large',
        onBehalfOf,
      });
      expect(resolved).toMatchObject({
        providerType: AiProviderType.CHATGPT_SUBSCRIPTION,
        modelId: 'gpt-plan-large',
        requiresStreaming: true,
      });
    });

    it('honours a thread\u2019s own provider and model', async () => {
      const { factory, modelForTurn, resolveSelection } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-large',
      );

      await factory.resolve({
        job: AiModelJob.CONVERSATION,
        aiProviderId: 'provider-1',
        modelId: 'gpt-plan-small',
        onBehalfOf,
      });

      expect(resolveSelection).not.toHaveBeenCalled();
      expect(modelForTurn).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: 'gpt-plan-small', onBehalfOf }),
      );
    });

    it('binds a middle manager run to the person it is for, as an unattended run', async () => {
      const { factory, modelForTurn, resolveSelection } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );
      const creator = { actorId: 'creator-1', automated: true };

      const resolved = await factory.resolve({
        job: AiModelJob.MIDDLE_MANAGER,
        onBehalfOf: creator,
      });

      expect(resolveSelection).toHaveBeenCalledWith(AiModelJob.MIDDLE_MANAGER);
      expect(modelForTurn).toHaveBeenCalledWith({
        providerId: 'provider-1',
        modelId: 'gpt-plan-small',
        onBehalfOf: creator,
      });
      expect(resolved.requiresStreaming).toBe(true);
    });

    it('refuses a middle manager run that does not say who it is for', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      await expect(factory.resolve({ job: AiModelJob.MIDDLE_MANAGER })).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('binds a user small task to the person who started it', async () => {
      const { factory, modelForTurn, resolveSelection } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      const resolved = await factory.resolve({
        job: AiModelJob.USER_SMALL_TASKS,
        onBehalfOf,
      });

      expect(resolveSelection).toHaveBeenCalledWith(AiModelJob.USER_SMALL_TASKS);
      expect(modelForTurn).toHaveBeenCalledWith({
        providerId: 'provider-1',
        modelId: 'gpt-plan-small',
        onBehalfOf,
      });
      expect(resolved.requiresStreaming).toBe(true);
    });

    it('refuses a user small task that does not say who started it', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      await expect(factory.resolve({ job: AiModelJob.USER_SMALL_TASKS })).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('refuses an unattended user small task, even with consent recorded elsewhere', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      await expect(
        factory.resolve({
          job: AiModelJob.USER_SMALL_TASKS,
          onBehalfOf: { actorId: 'creator-1', automated: true },
        }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_JOB_NOT_ALLOWED' });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it.each([
      undefined,
      { actorId: 'actor-1', automated: false },
      { actorId: 'actor-1', automated: true },
    ])('refuses a system small task whoever it names (%o)', async (forWhom) => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      await expect(
        factory.resolve({ job: AiModelJob.SYSTEM_SMALL_TASKS, onBehalfOf: forWhom }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_JOB_NOT_ALLOWED' });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('refuses the embeddings job even when told who it is for', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-large',
      );

      await expect(
        factory.resolve({ job: AiModelJob.EMBEDDINGS, onBehalfOf }),
      ).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('refuses a conversation call that does not say who it is for', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-large',
      );

      await expect(factory.resolve({ job: AiModelJob.CONVERSATION })).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });
  });
});
