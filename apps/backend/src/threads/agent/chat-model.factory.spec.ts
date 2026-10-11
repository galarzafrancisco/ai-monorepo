import { AiModelJob, AiProviderType } from 'src/ai-providers/enums';
import { ChatModelFactory } from './chat-model.factory';

jest.mock('src/ai-providers/ai-providers.service', () => ({ AiProvidersService: class {} }));
jest.mock('src/ai-providers/ai-model-selections.service', () => ({
  AiModelSelectionsService: class {},
}));
jest.mock('src/ai-providers/errors/ai-providers.errors', () => ({
  AiProviderNotConfiguredError: class extends Error {},
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

  const providerConfig = (type: AiProviderType) => ({
    id: 'provider-1',
    type,
    apiKey: null,
    baseUrl: null,
    project: null,
    location: null,
  });

  const factoryFor = (type: AiProviderType, selectedModelId: string) => {
    const resolveSelection = jest.fn(async () => ({
      provider: providerConfig(type),
      modelId: selectedModelId,
    }));
    const getAiProviderConfigById = jest.fn(async () => providerConfig(type));
    const factory = new ChatModelFactory(
      { getAiProviderConfigById } as never,
      { resolve: resolveSelection } as never,
    );
    return { factory, resolveSelection, getAiProviderConfigById };
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

  it("asks for the job's selection when the thread has no model of its own", async () => {
    const { factory, resolveSelection } = factoryFor(AiProviderType.ANTHROPIC, 'claude-haiku-5-5');

    const resolved = await factory.resolve({ job: AiModelJob.QUICK_TASKS });

    expect(resolveSelection).toHaveBeenCalledWith(AiModelJob.QUICK_TASKS);
    expect(resolved.modelId).toBe('claude-haiku-5-5');
  });

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
});
