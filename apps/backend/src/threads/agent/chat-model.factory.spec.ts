import { jsonSchema, streamText, tool } from 'ai';
import { AiModelJob, AiProviderType } from 'src/ai-providers/enums';
import { AiProviderConfigResult } from 'src/ai-providers/dto/service/ai-providers.service.types';
import { AiProviderNotConfiguredError } from 'src/ai-providers/errors/ai-providers.errors';
import { ChatModelFactory } from './chat-model.factory';
import { DEFAULT_WORKSPACE_ID } from '../../workspaces/workspaces.constants';

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
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_LOCATION',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
];

describe('ChatModelFactory', () => {
  const originalEnv = { ...process.env };

  // The provider service fills in what the environment provides, so a config
  // here is already resolved; Vertex AI by default runs on application default credentials.
  const providerConfig = (type: AiProviderType, overrides: Partial<AiProviderConfigResult> = {}) => ({
    id: 'provider-1',
    type,
    apiKey: type === AiProviderType.GOOGLE_VERTEX ? null : 'test-key',
    baseUrl: null,
    project: type === AiProviderType.GOOGLE_VERTEX ? 'my-project' : null,
    location: type === AiProviderType.GOOGLE_VERTEX ? 'global' : null,
    serverCredentials: true,
    ...overrides,
  });

  const factoryFor = (
    type: AiProviderType,
    selectedModelId: string,
    overrides: Partial<AiProviderConfigResult> = {},
  ) => {
    const resolveSelection = jest.fn(async () => ({
      provider: providerConfig(type, overrides),
      modelId: selectedModelId,
    }));
    const getAiProviderConfigById = jest.fn(async () => providerConfig(type, overrides));
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

  it('uses Vertex AI on application default credentials when no service account is stored', async () => {
    const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash');
    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION });

    expect(resolved).toMatchObject({
      providerType: AiProviderType.GOOGLE_VERTEX,
      modelId: 'gemini-3.6-flash',
    });
  });

  describe('a provider that may not use server credentials', () => {
    const serviceAccount = JSON.stringify({ client_email: 'sa@example.com', private_key: 'key' });

    it('refuses Vertex AI without its own service account, project and location', async () => {
      for (const overrides of [
        { apiKey: null },
        { apiKey: serviceAccount, project: null },
        { apiKey: serviceAccount, location: null },
      ]) {
        const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash', {
          serverCredentials: false,
          ...overrides,
        });
        await expect(
          factory.resolve({ workspaceId: 'workspace-b', job: AiModelJob.CONVERSATION }),
        ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
      }
    });

    it('runs Vertex AI on its own service account, ignoring GOOGLE_VERTEX_API_KEY', async () => {
      process.env.GOOGLE_VERTEX_API_KEY = 'server-key';
      try {
        const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash', {
          serverCredentials: false,
          apiKey: serviceAccount,
        });
        const resolved = await factory.resolve({
          workspaceId: 'workspace-b',
          job: AiModelJob.CONVERSATION,
        });
        // Express mode (the server key) would use the global endpoint without a project.
        expect((resolved.model as { config: { baseURL: string } }).config.baseURL).toContain(
          'projects/my-project',
        );
      } finally {
        delete process.env.GOOGLE_VERTEX_API_KEY;
      }
    });

    it.each([AiProviderType.GOOGLE, AiProviderType.OPENAI, AiProviderType.ANTHROPIC, AiProviderType.XAI])(
      'refuses %s without a stored key, even with a key in the environment',
      async (type) => {
        process.env.GOOGLE_API_KEY = 'server-key';
        process.env.OPENAI_API_KEY = 'server-key';
        process.env.ANTHROPIC_API_KEY = 'server-key';
        process.env.XAI_API_KEY = 'server-key';
        const { factory } = factoryFor(type, 'some-model', { apiKey: null, serverCredentials: false });
        await expect(
          factory.resolve({ workspaceId: 'workspace-b', job: AiModelJob.CONVERSATION }),
        ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
      },
    );
  });

  it('runs a Gemini model on Vertex AI through the Gemini API', async () => {
    const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, 'gemini-3.6-flash');
    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
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
      const { factory } = factoryFor(AiProviderType.GOOGLE_VERTEX, modelId, { location: 'us-east5' });
      const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION });

      expect(resolved).toMatchObject({ providerType: AiProviderType.GOOGLE_VERTEX, modelId });
      expect((resolved.model as { provider: string }).provider).toBe('googleVertex.anthropic.messages');
      expect((resolved.model as { modelId: string }).modelId).toBe(modelId);
    },
  );

  it('builds an xAI model for a Grok provider', async () => {
    const { factory } = factoryFor(AiProviderType.XAI, 'grok-4');

    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION });

    expect(resolved).toMatchObject({ providerType: AiProviderType.XAI, modelId: 'grok-4' });
    expect((resolved.model as { provider: string }).provider).toContain('xai');
  });

  it('sends an OpenAI model its tools in a namespace per MCP server, and Taico tools in their own', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const bodies: Array<{ tools: Array<{ type: string; name: string; tools: Array<{ name: string }> }> }> = [];
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(init?.body as string));
      return new Response('{"error":{"message":"stop here"}}', { status: 400 });
    });
    const { factory } = factoryFor(AiProviderType.OPENAI, 'gpt-test');
    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION });
    const noInput = jsonSchema<Record<string, never>>({ type: 'object', properties: {} });

    try {
      const result = streamText({
        model: resolved.model,
        prompt: 'what time is it?',
        tools: {
          tasks__get_all_tags: tool({ description: 'List all tags', inputSchema: noInput }),
          context__get_block: tool({ description: 'Get a block', inputSchema: noInput }),
          get_time: tool({ description: 'Get the current time', inputSchema: noInput }),
        },
        maxRetries: 0,
        onError: () => undefined,
      });
      await result.consumeStream();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(bodies[0].tools.map((ns) => [ns.type, ns.name, ns.tools.map((t) => t.name)])).toEqual([
      ['namespace', 'tasks', ['tasks__get_all_tags']],
      ['namespace', 'context', ['context__get_block']],
      ['namespace', 'taico', ['get_time']],
    ]);
  });

  it("asks for the job's selection when the thread has no model of its own", async () => {
    const { factory, resolveSelection } = factoryFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.SYSTEM_SMALL_TASKS });

    expect(resolveSelection).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, AiModelJob.SYSTEM_SMALL_TASKS);
    expect(resolved.modelId).toBe('claude-haiku-5-5');
  });

  it.each([AiModelJob.USER_SMALL_TASKS, AiModelJob.SYSTEM_SMALL_TASKS])(
    'runs %s on a provider with an API key, with or without a person',
    async (job) => {
      const { factory } = factoryFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

      await expect(factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job })).resolves.toMatchObject({
        providerType: AiProviderType.ANTHROPIC,
      });
      await expect(
        factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job, onBehalfOf: { actorId: 'actor-1', automated: false } }),
      ).resolves.toMatchObject({ providerType: AiProviderType.ANTHROPIC });
    },
  );

  it("uses the thread's own provider and model when both are set", async () => {
    const { factory, resolveSelection, getAiProviderConfigById } = factoryFor(
      AiProviderType.ANTHROPIC,
      'claude-haiku-5-5',
    );

    const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
      job: AiModelJob.CONVERSATION,
      aiProviderId: 'provider-1',
      modelId: 'claude-opus-5-5',
    });

    expect(getAiProviderConfigById).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, 'provider-1');
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

      const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION, onBehalfOf });

      expect(modelForTurn).toHaveBeenCalledWith({
        workspaceId: DEFAULT_WORKSPACE_ID,
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

      await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
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

      const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
        job: AiModelJob.MIDDLE_MANAGER,
        onBehalfOf: creator,
      });

      expect(resolveSelection).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, AiModelJob.MIDDLE_MANAGER);
      expect(modelForTurn).toHaveBeenCalledWith({
        workspaceId: DEFAULT_WORKSPACE_ID,
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

      await expect(factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.MIDDLE_MANAGER })).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('binds a user small task to the person who started it', async () => {
      const { factory, modelForTurn, resolveSelection } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-small',
      );

      const resolved = await factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
        job: AiModelJob.USER_SMALL_TASKS,
        onBehalfOf,
      });

      expect(resolveSelection).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID, AiModelJob.USER_SMALL_TASKS);
      expect(modelForTurn).toHaveBeenCalledWith({
        workspaceId: DEFAULT_WORKSPACE_ID,
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

      await expect(factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.USER_SMALL_TASKS })).rejects.toMatchObject({
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
        factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID,
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
        factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.SYSTEM_SMALL_TASKS, onBehalfOf: forWhom }),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_JOB_NOT_ALLOWED' });
      expect(modelForTurn).not.toHaveBeenCalled();
    });

    it('refuses the embeddings job even when told who it is for', async () => {
      const { factory, modelForTurn } = factoryFor(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        'gpt-plan-large',
      );

      await expect(
        factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.EMBEDDINGS, onBehalfOf }),
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

      await expect(factory.resolve({ workspaceId: DEFAULT_WORKSPACE_ID, job: AiModelJob.CONVERSATION })).rejects.toMatchObject({
        code: 'AI_PROVIDER_JOB_NOT_ALLOWED',
      });
      expect(modelForTurn).not.toHaveBeenCalled();
    });
  });
});
