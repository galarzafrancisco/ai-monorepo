import { AiProviderModelsService } from './ai-provider-models.service';
import { AiModelKind, AiProviderType } from './enums';

jest.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken = async () => 'token-1';
  },
}));
jest.mock('./errors/ai-providers.errors', () => {
  class AiProvidersDomainError extends Error {}
  return {
    AiProvidersDomainError,
    AiProviderNotConfiguredError: class extends AiProvidersDomainError {},
    AiProviderModelListingFailedError: class extends AiProvidersDomainError {
      constructor(_providerId: string, reason: string) {
        super(reason);
      }
    },
  };
});
jest.mock('./ai-providers.service',() => ({ AiProvidersService: class {} }));
jest.mock('./chatgpt-subscription/chatgpt-subscription.service', () => ({
  ChatgptSubscriptionService: class {},
}));

const vertexConfig = {
  id: 'provider-1',
  type: AiProviderType.GOOGLE_VERTEX,
  apiKey: null,
  baseUrl: null,
  project: 'my-project',
  location: 'global',
};

type FakeResponse = { status: number; body: unknown };

describe('AiProviderModelsService — Vertex AI', () => {
  const originalFetch = global.fetch;
  let responses: Record<string, FakeResponse>;
  let requestedUrls: string[];

  const service = () =>
    new AiProviderModelsService(
      { getAiProviderConfigById: async () => vertexConfig } as never,
      {} as never,
    );

  beforeEach(() => {
    requestedUrls = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);
      const publisher = url.match(/publishers\/([^/]+)\/models/)?.[1] ?? '';
      const response = responses[publisher] ?? { status: 404, body: {} };
      return {
        ok: response.status < 400,
        status: response.status,
        json: async () => response.body,
        text: async () => JSON.stringify(response.body),
      } as Response;
    }) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('lists Gemini and Claude models together', async () => {
    responses = {
      google: {
        status: 200,
        body: {
          publisherModels: [
            { name: 'publishers/google/models/gemini-3.6-flash' },
            { name: 'publishers/google/models/text-embedding-005' },
          ],
        },
      },
      anthropic: {
        status: 200,
        body: { publisherModels: [{ name: 'publishers/anthropic/models/claude-sonnet-4-5' }] },
      },
    };

    const models = await service().listModels('provider-1', 'actor-1');

    expect(models).toEqual([
      { id: 'claude-sonnet-4-5', displayName: null, kind: AiModelKind.LANGUAGE },
      { id: 'gemini-3.6-flash', displayName: null, kind: AiModelKind.LANGUAGE },
      { id: 'text-embedding-005', displayName: null, kind: AiModelKind.EMBEDDING },
    ]);
    expect(requestedUrls.some((url) => url.includes('/publishers/google/models'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/publishers/anthropic/models'))).toBe(true);
  });

  it('still lists Gemini models when Claude cannot be listed', async () => {
    responses = {
      google: {
        status: 200,
        body: { publisherModels: [{ name: 'publishers/google/models/gemini-3.6-flash' }] },
      },
      anthropic: { status: 403, body: { error: 'denied' } },
    };

    const models = await service().listModels('provider-1', 'actor-1');

    expect(models.map((model) => model.id)).toEqual(['gemini-3.6-flash']);
  });

  it('fails when Gemini cannot be listed', async () => {
    responses = {
      google: { status: 403, body: { error: 'denied' } },
      anthropic: {
        status: 200,
        body: { publisherModels: [{ name: 'publishers/anthropic/models/claude-sonnet-4-5' }] },
      },
    };

    await expect(service().listModels('provider-1', 'actor-1')).rejects.toMatchObject({
      message: expect.stringContaining('403'),
    });
  });
});
