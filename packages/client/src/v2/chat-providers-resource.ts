import { BaseClient, ClientConfig } from './base-client.js';
import type { ChatProviderResponseDto, CreateChatProviderDto, SetActiveChatProviderDto, UpdateChatProviderDto } from './types.js';

export class ChatProvidersResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new chat provider */
  async ChatProvidersController_createChatProvider(params: { body: CreateChatProviderDto; signal?: AbortSignal }): Promise<ChatProviderResponseDto> {
    return this.request('POST', '/api/v1/chat-providers', { body: params.body, signal: params?.signal });
  }

  /** List all chat providers */
  async ChatProvidersController_listChatProviders(params?: { signal?: AbortSignal }): Promise<ChatProviderResponseDto[]> {
    return this.request('GET', '/api/v1/chat-providers', { signal: params?.signal });
  }

  /** Get chat provider by ID */
  async ChatProvidersController_getChatProvider(params: { id: string; signal?: AbortSignal }): Promise<ChatProviderResponseDto> {
    return this.request('GET', `/api/v1/chat-providers/${params.id}`, { signal: params?.signal });
  }

  /** Update a chat provider */
  async ChatProvidersController_updateChatProvider(params: { id: string; body: UpdateChatProviderDto; signal?: AbortSignal }): Promise<ChatProviderResponseDto> {
    return this.request('PATCH', `/api/v1/chat-providers/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a chat provider */
  async ChatProvidersController_deleteChatProvider(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/chat-providers/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

  /** Set the active chat provider */
  async ChatProvidersController_setActiveChatProvider(params: { body: SetActiveChatProviderDto; signal?: AbortSignal }): Promise<ChatProviderResponseDto> {
    return this.request('POST', '/api/v1/chat-providers/set-active', { body: params.body, signal: params?.signal });
  }

  /** Deactivate the active chat provider */
  async ChatProvidersController_deactivateActiveChatProvider(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('POST', '/api/v1/chat-providers/deactivate', { responseType: 'void', signal: params?.signal });
  }

}