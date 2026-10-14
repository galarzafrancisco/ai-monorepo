import { Injectable } from '@nestjs/common';
import { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import { AiProvidersService } from 'src/ai-providers/ai-providers.service';
import {
  AiProviderConfigResult,
  OnBehalfOf,
} from 'src/ai-providers/dto/service/ai-providers.service.types';
import { ChatgptSubscriptionService } from 'src/ai-providers/chatgpt-subscription/chatgpt-subscription.service';
import { AiModelSelectionsService } from 'src/ai-providers/ai-model-selections.service';
import {
  AiModelJob,
  AiProviderType,
  USER_CONNECTED_PROVIDER_JOBS,
} from 'src/ai-providers/enums';
import {
  AiProviderJobNotAllowedError,
  AiProviderNotConfiguredError,
} from 'src/ai-providers/errors/ai-providers.errors';
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

export type ResolveChatModelInput = {
  /** The job the model is for. Decides which selection applies. */
  job: AiModelJob;
  /** A thread's own provider and model. Both must be set to override the job's selection. */
  aiProviderId?: string | null;
  modelId?: string | null;
  /**
   * Whose plan pays for the call. Needed by providers that run on a person's
   * own plan, which use that person's connection and nobody else's. Only the
   * threads agent (the person the turn is for) and the middle manager (the
   * thread's creator, as an unattended run) pass it; any other caller is
   * refused by those providers.
   */
  onBehalfOf?: OnBehalfOf;
};

/** Maps a job's selected provider and model to an AI SDK model. */
@Injectable()
export class ChatModelFactory {
  constructor(
    private readonly aiProvidersService: AiProvidersService,
    private readonly aiModelSelectionsService: AiModelSelectionsService,
    private readonly chatgptSubscription: ChatgptSubscriptionService,
  ) {}

  async resolve(input: ResolveChatModelInput): Promise<ResolvedChatModel> {
    if (input.aiProviderId && input.modelId) {
      const config = await this.aiProvidersService.getAiProviderConfigById(input.aiProviderId);
      return this.build(config, input.modelId, input);
    }

    const selection = await this.aiModelSelectionsService.resolve(input.job);
    return this.build(selection.provider, selection.modelId, input);
  }

  private async build(
    config: AiProviderConfigResult,
    modelId: string,
    input: ResolveChatModelInput,
  ): Promise<ResolvedChatModel> {
    const apiKey = config.apiKey ?? undefined;
    const baseURL = config.baseUrl ?? undefined;

    switch (config.type) {
      case AiProviderType.OPENAI:
        return {
          model: createOpenAI({ apiKey, baseURL })(modelId),
          providerType: config.type,
          modelId,
          // Send full history on every call instead of referencing items stored at OpenAI.
          providerOptions: { openai: { store: false } },
        };

      case AiProviderType.ANTHROPIC:
        return {
          model: createAnthropic({ apiKey, baseURL })(modelId),
          providerType: config.type,
          modelId,
        };

      case AiProviderType.GOOGLE:
        return {
          model: createGoogle({ apiKey: apiKey ?? googleApiKeyFromEnv(), baseURL })(modelId),
          providerType: config.type,
          modelId,
        };

      case AiProviderType.GOOGLE_VERTEX:
        return this.buildVertex(config, modelId);

      case AiProviderType.XAI:
        return {
          model: createXai({ apiKey, baseURL })(modelId),
          providerType: config.type,
          modelId,
        };

      case AiProviderType.OPENAI_COMPATIBLE:
        if (!baseURL) {
          throw new AiProviderNotConfiguredError(config.id);
        }
        return {
          model: createOpenAICompatible({ name: config.type, baseURL, apiKey })(modelId),
          providerType: config.type,
          modelId,
        };

      case AiProviderType.CHATGPT_SUBSCRIPTION:
        // A person's plan only runs jobs that say whose plan pays for the call.
        if (!USER_CONNECTED_PROVIDER_JOBS.includes(input.job) || !input.onBehalfOf) {
          throw new AiProviderJobNotAllowedError(config.id, input.job);
        }
        return {
          model: await this.chatgptSubscription.modelForTurn({
            providerId: config.id,
            modelId,
            onBehalfOf: input.onBehalfOf,
          }),
          providerType: config.type,
          modelId,
          requiresStreaming: true,
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
  private buildVertex(config: AiProviderConfigResult, modelId: string): ResolvedChatModel {
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
    };

    const model = isVertexAnthropicModelId(modelId)
      ? createVertexAnthropic(settings)(modelId)
      : createVertex(settings)(modelId);

    return { model, providerType: AiProviderType.GOOGLE_VERTEX, modelId };
  }
}
