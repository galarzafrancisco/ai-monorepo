import { Inject, Injectable } from '@nestjs/common';
import { LanguageModel } from 'ai';
import {
  AiProviderModelResult,
  OnBehalfOf,
} from '../dto/service/ai-providers.service.types';
import { AiModelKind } from '../enums';
import { ChatgptConnectionsService } from './chatgpt-connections.service';
import { createChatgptResponsesModel } from './chatgpt-responses.model';
import { chatgptRequestFailed } from './chatgpt-subscription.errors';
import { CHATGPT_SUBSCRIPTION_ENDPOINTS } from './chatgpt-subscription.constants';
import type { ChatgptSubscriptionEndpoints } from './chatgpt-subscription.constants';

const REQUEST_TIMEOUT_MS = 10_000;

type ModelCatalog = {
  models?: { slug?: unknown; display_name?: unknown; visibility?: unknown }[];
};

/** Inference and model discovery on a person's ChatGPT plan. */
@Injectable()
export class ChatgptSubscriptionService {
  constructor(
    private readonly connections: ChatgptConnectionsService,
    @Inject(CHATGPT_SUBSCRIPTION_ENDPOINTS)
    private readonly endpoints: ChatgptSubscriptionEndpoints,
  ) {}

  /**
   * The model for one thread turn, bound to the plan of the person the turn is
   * for. Throws when that person's connection cannot be used.
   */
  async modelForTurn(input: {
    providerId: string;
    modelId: string;
    onBehalfOf: OnBehalfOf;
  }): Promise<LanguageModel> {
    const { connectionId } = await this.connections.authorizeTurn(
      input.providerId,
      input.onBehalfOf,
    );

    return createChatgptResponsesModel({
      modelId: input.modelId,
      apiBaseUrl: this.endpoints.apiBaseUrl,
      getAccessToken: () => this.connections.getAccessToken(connectionId),
      onOutcome: (upstreamCode) => {
        void this.connections.recordOutcome(connectionId, upstreamCode);
      },
    });
  }

  /**
   * The models the person's own account offers, in OpenAI's order. Each
   * account has its own catalog, so this is never answered from another
   * person's connection.
   */
  async listModels(
    providerId: string,
    actorId: string,
  ): Promise<AiProviderModelResult[]> {
    const { connectionId } = await this.connections.requireOwnConnection(
      providerId,
      actorId,
    );
    const accessToken = await this.connections.getAccessToken(connectionId);

    const response = await fetch(
      `${this.endpoints.apiBaseUrl.replace(/\/+$/, '')}/models`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { code?: unknown; message?: unknown };
      };
      throw chatgptRequestFailed({
        code: typeof body.error?.code === 'string' ? body.error.code : null,
        message:
          typeof body.error?.message === 'string' ? body.error.message : null,
        status: response.status,
        requestId: response.headers.get('x-request-id'),
      });
    }

    const catalog = (await response.json()) as ModelCatalog;
    return (catalog.models ?? [])
      .filter(
        (
          model,
        ): model is {
          slug: string;
          display_name?: unknown;
          visibility: 'list';
        } =>
          model.visibility === 'list' &&
          typeof model.slug === 'string' &&
          !!model.slug,
      )
      .map((model) => ({
        id: model.slug,
        displayName:
          typeof model.display_name === 'string' ? model.display_name : null,
        kind: AiModelKind.LANGUAGE,
      }));
  }
}
