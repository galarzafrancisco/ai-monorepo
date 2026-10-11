import { ChatProviderType } from 'src/chat-providers/enums';
import { ChatModelFactory } from './chat-model.factory';

jest.mock('src/chat-providers/chat-providers.service', () => ({ ChatProvidersService: class {} }));
jest.mock('src/chat-providers/errors/chat-providers.errors', () => ({
  ChatProviderNotConfiguredError: class extends Error {},
}));

const GOOGLE_ENV_KEYS = [
  'GOOGLE_GENAI_USE_VERTEXAI',
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

  it.each(['true', 'True', 'TRUE', '1'])(
    'uses Vertex AI for the environment-only provider when GOOGLE_GENAI_USE_VERTEXAI=%s',
    async (flag) => {
      process.env.GOOGLE_GENAI_USE_VERTEXAI = flag;
      process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'global';

      const resolved = await factoryFor(ChatProviderType.ADK).resolve({});

      expect(resolved).toMatchObject({
        providerType: ChatProviderType.GOOGLE_VERTEX,
        modelId: 'gemini-3.6-flash',
      });
    },
  );

  it('uses the Gemini API for the environment-only provider when the Vertex flag is off', async () => {
    process.env.GOOGLE_API_KEY = 'test-key';

    const resolved = await factoryFor(ChatProviderType.ADK).resolve({});

    expect(resolved.providerType).toBe(ChatProviderType.GOOGLE);
  });
});
