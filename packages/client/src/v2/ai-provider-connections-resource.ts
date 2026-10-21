import { BaseClient, ClientConfig } from './base-client.js';
import type { AiProviderConnectionResponseDto, CompleteAiProviderAuthorizationDto, DisconnectAiProviderResponseDto, StartAiProviderAuthorizationResponseDto, UpdateAiProviderConnectionDto } from './types.js';

export class AiProviderConnectionsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Get your own connection to the provider */
  async AiProviderConnectionsController_getConnection(params: { id: string; signal?: AbortSignal }): Promise<AiProviderConnectionResponseDto> {
    return this.request('GET', `/api/v1/ai-providers/${params.id}/connection`, { signal: params?.signal });
  }

  /** Change what your connection may be used for */
  async AiProviderConnectionsController_updateConnection(params: { id: string; body: UpdateAiProviderConnectionDto; signal?: AbortSignal }): Promise<AiProviderConnectionResponseDto> {
    return this.request('PATCH', `/api/v1/ai-providers/${params.id}/connection`, { body: params.body, signal: params?.signal });
  }

  /** Disconnect your account and revoke its grant at the provider */
  async AiProviderConnectionsController_disconnect(params: { id: string; signal?: AbortSignal }): Promise<DisconnectAiProviderResponseDto> {
    return this.request('DELETE', `/api/v1/ai-providers/${params.id}/connection`, { signal: params?.signal });
  }

  /** Start signing in to the provider with your own account */
  async AiProviderConnectionsController_startAuthorization(params: { id: string; signal?: AbortSignal }): Promise<StartAiProviderAuthorizationResponseDto> {
    return this.request('POST', `/api/v1/ai-providers/${params.id}/connection/authorize`, { signal: params?.signal });
  }

  /** Finish the sign-in you started with what the provider sent back */
  async AiProviderConnectionsController_completeAuthorization(params: { id: string; body: CompleteAiProviderAuthorizationDto; signal?: AbortSignal }): Promise<AiProviderConnectionResponseDto> {
    return this.request('POST', `/api/v1/ai-providers/${params.id}/connection/callback`, { body: params.body, signal: params?.signal });
  }

}