import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingModel, embed, embedMany } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import { AiModelSelectionsService } from 'src/ai-providers/ai-model-selections.service';
import { AiProviderConfigResult } from 'src/ai-providers/dto/service/ai-providers.service.types';
import { AiModelJob, AiProviderType } from 'src/ai-providers/enums';
import {
  googleApiKeyFromEnv,
  vertexLocationFromEnv,
  vertexProjectFromEnv,
} from 'src/ai-providers/google-environment';

export type ResolvedEmbeddingModel = {
  model: EmbeddingModel;
  /** Identifies the provider and model. Stored with every embedding, so a change is detected. */
  key: string;
  modelId: string;
};

const QUERY_CACHE_SIZE = 200;

/** Turns text into embeddings with the model selected for the embeddings job. */
@Injectable()
export class SearchEmbeddingsService {
  private readonly logger = new Logger(SearchEmbeddingsService.name);
  /** Recent query embeddings, so typing the same search twice costs one call. */
  private readonly queryCache = new Map<string, number[]>();

  constructor(private readonly aiModelSelectionsService: AiModelSelectionsService) {}

  /** The selected embedding model, or null when none is selected or its provider is not usable. */
  async resolveModel(): Promise<ResolvedEmbeddingModel | null> {
    try {
      const selection = await this.aiModelSelectionsService.resolve(AiModelJob.EMBEDDINGS);
      const model = buildEmbeddingModel(selection.provider, selection.modelId);
      if (!model) {
        return null;
      }
      return {
        model,
        key: `${selection.provider.id}:${selection.modelId}`,
        modelId: selection.modelId,
      };
    } catch (error) {
      this.logger.debug({
        message: 'No usable embedding model',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Embeds passages for the index. Passages take no instruction prefix. */
  async embedDocuments(resolved: ResolvedEmbeddingModel, texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const { embeddings } = await embedMany({ model: resolved.model, values: texts });
    return embeddings;
  }

  /**
   * Embeds a search query. Instruction-aware models (Qwen3, E5, ...) match
   * much better when the query says what it is for; passages stay plain.
   */
  async embedQuery(
    resolved: ResolvedEmbeddingModel,
    query: string,
    options: { instruction: string; timeoutMs: number },
  ): Promise<number[]> {
    const value = options.instruction
      ? `Instruct: ${options.instruction}\nQuery: ${query}`
      : query;
    const cacheKey = `${resolved.key}\n${value}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { embedding } = await embed({
      model: resolved.model,
      value,
      // A search must answer quickly; one attempt, bounded by the timeout.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(options.timeoutMs),
    });

    this.queryCache.set(cacheKey, embedding);
    if (this.queryCache.size > QUERY_CACHE_SIZE) {
      this.queryCache.delete(this.queryCache.keys().next().value as string);
    }
    return embedding;
  }
}

function buildEmbeddingModel(config: AiProviderConfigResult, modelId: string): EmbeddingModel | null {
  const apiKey = config.apiKey ?? undefined;
  const baseURL = config.baseUrl ?? undefined;

  switch (config.type) {
    case AiProviderType.OPENAI:
      return createOpenAI({ apiKey, baseURL }).textEmbeddingModel(modelId);

    case AiProviderType.GOOGLE:
      return createGoogle({ apiKey: apiKey ?? googleApiKeyFromEnv(), baseURL }).textEmbeddingModel(
        modelId,
      );

    case AiProviderType.GOOGLE_VERTEX: {
      const credentials = apiKey ? (JSON.parse(apiKey) as Record<string, unknown>) : undefined;
      return createVertex({
        project: config.project ?? vertexProjectFromEnv(),
        location: config.location ?? vertexLocationFromEnv(),
        googleAuthOptions: credentials ? { credentials } : undefined,
      }).textEmbeddingModel(modelId);
    }

    case AiProviderType.XAI:
      return createXai({ apiKey, baseURL }).textEmbeddingModel(modelId);

    case AiProviderType.ANTHROPIC:
      return createAnthropic({ apiKey, baseURL }).textEmbeddingModel(modelId);

    case AiProviderType.OPENAI_COMPATIBLE:
      if (!baseURL) {
        return null;
      }
      return createOpenAICompatible({ name: config.type, baseURL, apiKey }).textEmbeddingModel(
        modelId,
      );

    case AiProviderType.CHATGPT_SUBSCRIPTION:
      // A person's plan only answers in threads. It cannot be selected for embeddings.
      return null;
  }
}
