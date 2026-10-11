import { Injectable } from '@nestjs/common';
import { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ChatProvidersService } from 'src/chat-providers/chat-providers.service';
import { ChatProviderConfigResult } from 'src/chat-providers/dto/service/chat-providers.service.types';
import { ChatProviderType } from 'src/chat-providers/enums';
import { ChatProviderNotConfiguredError } from 'src/chat-providers/errors/chat-providers.errors';

type ProviderOptions = Record<string, Record<string, string | number | boolean | null>>;

export type ResolvedChatModel = {
  model: LanguageModel;
  /** Recorded on every agent-log row so history can be adapted when the model changes. */
  providerType: string;
  modelId: string;
  providerOptions?: ProviderOptions;
};

export type ResolveChatModelInput = {
  /** Null or undefined uses the active chat provider. */
  chatProviderId?: string | null;
  /** Null or undefined uses the provider's own model, then its default. */
  modelId?: string | null;
  /**
   * The agent's configured model. It predates per-provider models, so it only
   * applies to the provider types that existed back then.
   */
  legacyModelId?: string | null;
};

const DEFAULT_MODELS: Partial<Record<ChatProviderType, string>> = {
  [ChatProviderType.OPENAI]: 'gpt-5.4',
  [ChatProviderType.ANTHROPIC]: 'claude-opus-5-5',
  [ChatProviderType.GOOGLE]: 'gemini-3.6-flash',
  [ChatProviderType.GOOGLE_VERTEX]: 'gemini-3.6-flash',
  [ChatProviderType.ADK]: 'gemini-3.6-flash',
};

const LEGACY_MODEL_PROVIDER_TYPES = [ChatProviderType.OPENAI, ChatProviderType.ADK];

/** Matches the Google SDKs, which read this flag case-insensitively ("True", "true", "1"). */
function isEnvFlagEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function vertexProjectFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
}

function vertexLocationFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_LOCATION ?? process.env.GOOGLE_CLOUD_LOCATION;
}

function googleApiKeyFromEnv(): string | undefined {
  return (
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );
}

/** Maps a configured chat provider and model id to an AI SDK model. */
@Injectable()
export class ChatModelFactory {
  constructor(private readonly chatProvidersService: ChatProvidersService) {}

  async resolve(input: ResolveChatModelInput): Promise<ResolvedChatModel> {
    const config = input.chatProviderId
      ? await this.chatProvidersService.getChatProviderConfigById(input.chatProviderId)
      : await this.chatProvidersService.getActiveChatProviderConfig();

    const modelId =
      input.modelId ??
      config.modelId ??
      (LEGACY_MODEL_PROVIDER_TYPES.includes(config.type) ? input.legacyModelId : null) ??
      DEFAULT_MODELS[config.type];

    if (!modelId) {
      throw new ChatProviderNotConfiguredError(config.id);
    }

    return this.build(config, modelId);
  }

  private build(config: ChatProviderConfigResult, modelId: string): ResolvedChatModel {
    const apiKey = config.apiKey ?? undefined;
    const baseURL = config.baseUrl ?? undefined;

    switch (config.type) {
      case ChatProviderType.OPENAI:
        return {
          model: createOpenAI({ apiKey, baseURL })(modelId),
          providerType: config.type,
          modelId,
          // Send full history on every call instead of referencing items stored at OpenAI.
          providerOptions: { openai: { store: false } },
        };

      case ChatProviderType.ANTHROPIC:
        return {
          model: createAnthropic({ apiKey, baseURL })(modelId),
          providerType: config.type,
          modelId,
        };

      case ChatProviderType.GOOGLE:
        return {
          model: createGoogle({ apiKey: apiKey ?? googleApiKeyFromEnv(), baseURL })(modelId),
          providerType: config.type,
          modelId,
        };

      case ChatProviderType.GOOGLE_VERTEX:
        return this.buildVertex(config, modelId);

      case ChatProviderType.OPENAI_COMPATIBLE:
        if (!baseURL) {
          throw new ChatProviderNotConfiguredError(config.id);
        }
        return {
          model: createOpenAICompatible({ name: config.type, baseURL, apiKey })(modelId),
          providerType: config.type,
          modelId,
        };

      case ChatProviderType.ADK:
        // No stored settings: Vertex AI when GOOGLE_GENAI_USE_VERTEXAI is set,
        // otherwise the Gemini API with a key from the environment.
        return isEnvFlagEnabled(process.env.GOOGLE_GENAI_USE_VERTEXAI)
          ? this.buildVertex(config, modelId)
          : {
              model: createGoogle({ apiKey: googleApiKeyFromEnv() })(modelId),
              providerType: ChatProviderType.GOOGLE,
              modelId,
            };
    }
  }

  /**
   * Stored project, location and service account win. Anything left empty
   * falls back to the environment and application default credentials.
   */
  private buildVertex(config: ChatProviderConfigResult, modelId: string): ResolvedChatModel {
    let credentials: Record<string, unknown> | undefined;
    if (config.apiKey) {
      try {
        credentials = JSON.parse(config.apiKey);
      } catch {
        throw new ChatProviderNotConfiguredError(config.id);
      }
    }

    const vertex = createVertex({
      project: config.project ?? vertexProjectFromEnv(),
      location: config.location ?? vertexLocationFromEnv(),
      googleAuthOptions: credentials ? { credentials } : undefined,
    });

    return { model: vertex(modelId), providerType: ChatProviderType.GOOGLE_VERTEX, modelId };
  }
}
