import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { AiProvidersService } from './ai-providers.service';
import {
  AiProviderConfigResult,
  AiProviderModelResult,
} from './dto/service/ai-providers.service.types';
import { AiModelKind, AiProviderType } from './enums';
import {
  AiProviderModelListingFailedError,
  AiProviderNotConfiguredError,
} from './errors/ai-providers.errors';
import { googleApiKeyFromEnv, vertexProjectFromEnv } from './google-environment';
import { ChatgptSubscriptionService } from './chatgpt-subscription/chatgpt-subscription.service';
import { AiProvidersDomainError } from './errors/ai-providers.errors';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const XAI_BASE_URL = 'https://api.x.ai/v1';
const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
/**
 * The global endpoint lists a publisher's models. Regional endpoints return the
 * whole Model Garden (vision, OCR, AutoML), which is not what a user picks from.
 * `google` holds the Gemini models, `anthropic` the Claude models.
 */
const VERTEX_PUBLISHER_MODELS_URL = 'https://aiplatform.googleapis.com/v1beta1/publishers';

type OpenAiModelList = { data?: { id?: string }[] };
type AnthropicModelList = {
  data?: { id?: string; display_name?: string }[];
  has_more?: boolean;
  last_id?: string;
};
type GoogleModelList = {
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  nextPageToken?: string;
};
type VertexModelList = {
  publisherModels?: { name?: string }[];
  nextPageToken?: string;
};

/** Providers do not say what a model is for, so the id is the only signal available everywhere. */
function kindFromId(id: string): AiModelKind {
  return /embed/i.test(id) ? AiModelKind.EMBEDDING : AiModelKind.LANGUAGE;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Asks a provider which models it offers. The AI SDK has no call for this, so
 * each provider type's own listing endpoint is used.
 */
@Injectable()
export class AiProviderModelsService {
  private readonly logger = new Logger(AiProviderModelsService.name);

  constructor(
    private readonly aiProvidersService: AiProvidersService,
    private readonly chatgptSubscription: ChatgptSubscriptionService,
  ) {}

  /**
   * `actorId` is who is asking. Providers that run on a person's own plan list
   * that person's models; the others ignore it.
   */
  async listModels(providerId: string, actorId: string): Promise<AiProviderModelResult[]> {
    const config = await this.aiProvidersService.getAiProviderConfigById(providerId);

    if (config.type === AiProviderType.CHATGPT_SUBSCRIPTION) {
      try {
        // Kept in the order OpenAI returns them.
        return await this.chatgptSubscription.listModels(providerId, actorId);
      } catch (error) {
        if (error instanceof AiProvidersDomainError) {
          throw error;
        }
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn({ message: 'Listing provider models failed', providerId, reason });
        throw new AiProviderModelListingFailedError(providerId, reason);
      }
    }

    let models: AiProviderModelResult[];
    try {
      models = await this.fetchModels(config);
    } catch (error) {
      if (error instanceof AiProviderNotConfiguredError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn({ message: 'Listing provider models failed', providerId, reason });
      throw new AiProviderModelListingFailedError(providerId, reason);
    }

    const unique = new Map(models.map((model) => [model.id, model]));
    return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  private fetchModels(config: AiProviderConfigResult): Promise<AiProviderModelResult[]> {
    switch (config.type) {
      case AiProviderType.OPENAI:
        return this.listOpenAi(config.baseUrl ?? OPENAI_BASE_URL, config.apiKey);
      case AiProviderType.XAI:
        // xAI serves the same model list shape as OpenAI.
        return this.listOpenAi(config.baseUrl ?? XAI_BASE_URL, config.apiKey);
      case AiProviderType.OPENAI_COMPATIBLE:
        if (!config.baseUrl) {
          throw new AiProviderNotConfiguredError(config.id);
        }
        return this.listOpenAi(config.baseUrl, config.apiKey);
      case AiProviderType.ANTHROPIC:
        return this.listAnthropic(config);
      case AiProviderType.GOOGLE:
        return this.listGoogle(config);
      case AiProviderType.GOOGLE_VERTEX:
        return this.listVertex(config);
      case AiProviderType.CHATGPT_SUBSCRIPTION:
        // Listed per person in listModels; there are no shared credentials to list with.
        throw new AiProviderNotConfiguredError(config.id);
    }
  }

  private async listOpenAi(
    baseUrl: string,
    apiKey: string | null,
  ): Promise<AiProviderModelResult[]> {
    const body = await this.getJson<OpenAiModelList>(
      `${trimSlash(baseUrl)}/models`,
      apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    );

    return (body.data ?? [])
      .filter((model): model is { id: string } => !!model.id)
      .map((model) => ({ id: model.id, displayName: null, kind: kindFromId(model.id) }));
  }

  private async listAnthropic(config: AiProviderConfigResult): Promise<AiProviderModelResult[]> {
    const baseUrl = trimSlash(config.baseUrl ?? ANTHROPIC_BASE_URL);
    const headers = { 'x-api-key': config.apiKey ?? '', 'anthropic-version': '2023-06-01' };
    const models: AiProviderModelResult[] = [];
    let afterId: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ limit: '1000' });
      if (afterId) {
        query.set('after_id', afterId);
      }
      const body = await this.getJson<AnthropicModelList>(`${baseUrl}/models?${query}`, headers);

      for (const model of body.data ?? []) {
        if (model.id) {
          models.push({
            id: model.id,
            displayName: model.display_name ?? null,
            kind: kindFromId(model.id),
          });
        }
      }

      if (!body.has_more || !body.last_id) {
        break;
      }
      afterId = body.last_id;
    }

    return models;
  }

  private async listGoogle(config: AiProviderConfigResult): Promise<AiProviderModelResult[]> {
    const baseUrl = trimSlash(config.baseUrl ?? GOOGLE_BASE_URL);
    const headers = { 'x-goog-api-key': config.apiKey ?? googleApiKeyFromEnv() ?? '' };
    const models: AiProviderModelResult[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) {
        query.set('pageToken', pageToken);
      }
      const body = await this.getJson<GoogleModelList>(`${baseUrl}/models?${query}`, headers);

      for (const model of body.models ?? []) {
        const id = model.name?.replace(/^models\//, '');
        const methods = model.supportedGenerationMethods ?? [];
        // This API does say what a model can do, so use it instead of guessing from the id.
        const kind = methods.includes('generateContent')
          ? AiModelKind.LANGUAGE
          : methods.includes('embedContent')
            ? AiModelKind.EMBEDDING
            : null;
        if (id && kind) {
          models.push({ id, displayName: model.displayName ?? null, kind });
        }
      }

      if (!body.nextPageToken) {
        break;
      }
      pageToken = body.nextPageToken;
    }

    return models;
  }

  private async listVertex(config: AiProviderConfigResult): Promise<AiProviderModelResult[]> {
    let credentials: Record<string, unknown> | undefined;
    if (config.apiKey) {
      try {
        credentials = JSON.parse(config.apiKey);
      } catch {
        throw new AiProviderNotConfiguredError(config.id);
      }
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const token = await auth.getAccessToken();
    const project = config.project ?? vertexProjectFromEnv();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (project) {
      // User credentials are rejected without a project to bill the request to.
      headers['x-goog-user-project'] = project;
    }

    const [gemini, claude] = await Promise.allSettled([
      this.listVertexPublisher('google', headers),
      this.listVertexPublisher('anthropic', headers),
    ]);

    // Gemini is the main offering: if it cannot be listed, the listing fails.
    if (gemini.status === 'rejected') {
      throw gemini.reason;
    }

    // Claude is extra. A project without access to it still lists Gemini.
    if (claude.status === 'rejected') {
      const reason = claude.reason instanceof Error ? claude.reason.message : String(claude.reason);
      this.logger.warn({
        message: 'Listing Claude models on Vertex AI failed; listing Gemini models only',
        providerId: config.id,
        reason,
      });
      return gemini.value;
    }

    // Claude has no embedding models; the ids are listed as language models.
    return [...gemini.value, ...claude.value];
  }

  private async listVertexPublisher(
    publisher: 'google' | 'anthropic',
    headers: Record<string, string>,
  ): Promise<AiProviderModelResult[]> {
    const models: AiProviderModelResult[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ pageSize: '300' });
      if (pageToken) {
        query.set('pageToken', pageToken);
      }
      const body = await this.getJson<VertexModelList>(
        `${VERTEX_PUBLISHER_MODELS_URL}/${publisher}/models?${query}`,
        headers,
      );

      for (const model of body.publisherModels ?? []) {
        const id = model.name?.split('/').pop();
        if (id) {
          models.push({ id, displayName: null, kind: kindFromId(id) });
        }
      }

      if (!body.nextPageToken) {
        break;
      }
      pageToken = body.nextPageToken;
    }

    return models;
  }

  private async getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`the provider answered ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    return (await response.json()) as T;
  }
}
