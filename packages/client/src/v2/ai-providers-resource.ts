import { BaseClient, ClientConfig } from './base-client.js';
import type { AiProviderModelResponseDto, AiProviderResponseDto, CreateAiProviderDto, UpdateAiProviderDto } from './types.js';

export class AiProvidersResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create an AI provider */
  async AiProvidersController_createAiProvider(params: { body: CreateAiProviderDto; signal?: AbortSignal }): Promise<AiProviderResponseDto> {
    return this.request('POST', '/api/v1/ai-providers', { body: params.body, signal: params?.signal });
  }

  /** List all AI providers */
  async AiProvidersController_listAiProviders(params?: { signal?: AbortSignal }): Promise<AiProviderResponseDto[]> {
    return this.request('GET', '/api/v1/ai-providers', { signal: params?.signal });
  }

  /** Get AI provider by ID */
  async AiProvidersController_getAiProvider(params: { id: string; signal?: AbortSignal }): Promise<AiProviderResponseDto> {
    return this.request('GET', `/api/v1/ai-providers/${params.id}`, { signal: params?.signal });
  }

  /** Update an AI provider */
  async AiProvidersController_updateAiProvider(params: { id: string; body: UpdateAiProviderDto; signal?: AbortSignal }): Promise<AiProviderResponseDto> {
    return this.request('PATCH', `/api/v1/ai-providers/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete an AI provider */
  async AiProvidersController_deleteAiProvider(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/ai-providers/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

  /** List the models the provider offers, fetched live from the provider */
  async AiProvidersController_listAiProviderModels(params: { id: string; signal?: AbortSignal }): Promise<AiProviderModelResponseDto[]> {
    return this.request('GET', `/api/v1/ai-providers/${params.id}/models`, { signal: params?.signal });
  }

}