import { ChatProviderType } from 'src/chat-providers/enums';
import { ChatModelFactory } from './chat-model.factory';

jest.mock('src/chat-providers/chat-providers.service', () => ({ ChatProvidersService: class {} }));
jest.mock('src/chat-providers/errors/chat-providers.errors', () => ({
  ChatProviderNotConfiguredError: class extends Error {},
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

  const factoryFor = (type: ChatProviderType) =>
    new ChatModelFactory({
      getActiveChatProviderConfig: async () => ({
        id: 'provider-1',
        type,
        apiKey: null,
        modelId: null,
        baseUrl: null,
        project: null,
        location: null,
      }),
    } as never);

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

    const resolved = await factoryFor(ChatProviderType.GOOGLE_VERTEX).resolve({});

    expect(resolved).toMatchObject({
      providerType: ChatProviderType.GOOGLE_VERTEX,
      modelId: 'gemini-3.6-flash',
    });
  });

  it('only applies the agent model to OpenAI, where it predates per-provider models', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'global';

    const vertex = await factoryFor(ChatProviderType.GOOGLE_VERTEX).resolve({
      legacyModelId: 'gpt-5.4',
    });
    const openai = await factoryFor(ChatProviderType.OPENAI).resolve({
      legacyModelId: 'gpt-5.5',
    });

    expect(vertex.modelId).toBe('gemini-3.6-flash');
    expect(openai.modelId).toBe('gpt-5.5');
  });
});
