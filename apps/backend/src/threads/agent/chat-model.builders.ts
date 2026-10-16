import { LanguageModel, wrapLanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import { AiProviderConfigResult } from 'src/ai-providers/dto/service/ai-providers.service.types';
import { openaiToolNamespacesMiddleware } from 'src/ai-providers/openai-tool-namespaces';
import { AiProviderType } from 'src/ai-providers/enums';
import { AiProviderNotConfiguredError } from 'src/ai-providers/errors/ai-providers.errors';
import {
  googleApiKeyFromEnv,
  isVertexAnthropicModelId,
  vertexLocationFromEnv,
  vertexProjectFromEnv,
} from 'src/ai-providers/google-environment';

type ProviderOptions = Record<string, Record<string, string | number | boolean | null>>;

export type ResolvedChatModel = {
  model: LanguageModel;
  /** Recorded on every agent-log row so history can be adapted when the model changes. */
  providerType: string;
  modelId: string;
  providerOptions?: ProviderOptions;
  /**
   * True when the provider rejects non-streaming requests. Callers that only
   * want the final text must still call streamText() and read it to the end.
   */
  requiresStreaming?: boolean;
};

/** Provider types `createChatModel` can build. The ChatGPT plan needs a person's connection, so only the factory builds it. */
export type ApiKeyProviderType = Exclude<AiProviderType, AiProviderType.CHATGPT_SUBSCRIPTION>;

export type CreateChatModelOptions = {
  /** Replaces the provider SDK's fetch. Used by evals to capture or rewrite request bodies. */
  fetch?: typeof globalThis.fetch;
};

/**
 * Builds an AI SDK model for every provider that runs on stored settings
 * (API key, base URL, Vertex project) rather than a person's plan. Pure: no
 * DI, no database. `ChatModelFactory` and the evals both use it, so the
 * request shape can't drift between them.
 */
export function createChatModel(
  config: AiProviderConfigResult & { type: ApiKeyProviderType },
  modelId: string,
  opts: CreateChatModelOptions = {},
): ResolvedChatModel {
  const apiKey = config.apiKey ?? undefined;
  const baseURL = config.baseUrl ?? undefined;
  const { fetch } = opts;

  switch (config.type) {
    case AiProviderType.OPENAI:
      return {
        model: wrapLanguageModel({
          model: createOpenAI({ apiKey, baseURL, fetch })(modelId),
          middleware: openaiToolNamespacesMiddleware,
        }),
        providerType: config.type,
        modelId,
        // Send full history on every call instead of referencing items stored at OpenAI.
        providerOptions: { openai: { store: false } },
      };

    case AiProviderType.ANTHROPIC:
      return {
        model: createAnthropic({ apiKey, baseURL, fetch })(modelId),
        providerType: config.type,
        modelId,
      };

    case AiProviderType.GOOGLE:
      return {
        model: createGoogle({ apiKey: apiKey ?? googleApiKeyFromEnv(), baseURL, fetch })(modelId),
        providerType: config.type,
        modelId,
      };

    case AiProviderType.GOOGLE_VERTEX:
      return buildVertex(config, modelId, fetch);

    case AiProviderType.XAI:
      return {
        model: createXai({ apiKey, baseURL, fetch })(modelId),
        providerType: config.type,
        modelId,
      };

    case AiProviderType.OPENAI_COMPATIBLE:
      if (!baseURL) {
        throw new AiProviderNotConfiguredError(config.id);
      }
      return {
        model: createOpenAICompatible({ name: config.type, baseURL, apiKey, fetch })(modelId),
        providerType: config.type,
        modelId,
      };
  }
}

/**
 * Stored project, location and service account win. Anything left empty
 * falls back to the environment and application default credentials.
 *
 * Claude models (`claude-*`) go through Vertex AI's Anthropic API; every
 * other model id goes through the Gemini API. Both use the same project,
 * location and credentials.
 */
function buildVertex(
  config: AiProviderConfigResult,
  modelId: string,
  fetch: typeof globalThis.fetch | undefined,
): ResolvedChatModel {
  let credentials: Record<string, unknown> | undefined;
  if (config.apiKey) {
    try {
      credentials = JSON.parse(config.apiKey);
    } catch {
      throw new AiProviderNotConfiguredError(config.id);
    }
  }

  const settings = {
    project: config.project ?? vertexProjectFromEnv(),
    location: config.location ?? vertexLocationFromEnv(),
    googleAuthOptions: credentials ? { credentials } : undefined,
    fetch,
  };

  const model = isVertexAnthropicModelId(modelId)
    ? createVertexAnthropic(settings)(modelId)
    : createVertex(settings)(modelId);

  return { model, providerType: AiProviderType.GOOGLE_VERTEX, modelId };
}
