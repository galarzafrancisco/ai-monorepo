import { Injectable } from '@nestjs/common';
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
import { AiProviderJobNotAllowedError } from 'src/ai-providers/errors/ai-providers.errors';
import { createChatModel, ResolvedChatModel } from './chat-model.builders';

export type { ResolvedChatModel } from './chat-model.builders';

export type ResolveChatModelInput = {
  /** The job the model is for. Decides which selection applies. */
  job: AiModelJob;
  /** A thread's own provider and model. Both must be set to override the job's selection. */
  aiProviderId?: string | null;
  modelId?: string | null;
  /**
   * Whose plan pays for the call. Needed by providers that run on a person's
   * own plan, which use that person's connection and nobody else's. Only the
   * threads agent (the person the turn is for), the middle manager (the
   * thread's creator, as an unattended run) and user small tasks (the person
   * who started the call, never unattended) pass it; any other caller, and
   * every system small task, is refused by those providers.
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
    const { type } = config;
    if (type !== AiProviderType.CHATGPT_SUBSCRIPTION) {
      return createChatModel({ ...config, type }, modelId);
    }

    // A person's plan only runs jobs that say whose plan pays for the call.
    // User small tasks additionally need the person who started the call
    // right now; an unattended call is not theirs to pay for.
    if (
      !USER_CONNECTED_PROVIDER_JOBS.includes(input.job) ||
      !input.onBehalfOf ||
      (input.job === AiModelJob.USER_SMALL_TASKS && input.onBehalfOf.automated)
    ) {
      throw new AiProviderJobNotAllowedError(config.id, input.job);
    }
    return {
      model: await this.chatgptSubscription.modelForTurn({
        providerId: config.id,
        modelId,
        onBehalfOf: input.onBehalfOf,
      }),
      providerType: type,
      modelId,
      requiresStreaming: true,
    };
  }
}
