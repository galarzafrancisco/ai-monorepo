import { BaseClient, ClientConfig } from './base-client.js';
import type { ActorResponseDto } from './types.js';

export class ActorsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List all actors (users and agents) */
  async ActorController_listActors(params?: { signal?: AbortSignal }): Promise<ActorResponseDto[]> {
    return this.request('GET', '/api/v1/actors', { signal: params?.signal });
  }

  /** Search actors by display name or slug */
  async ActorController_searchActors(params: { query: string; limit?: number; threshold?: number; signal?: AbortSignal }): Promise<ActorResponseDto[]> {
    return this.request('GET', '/api/v1/actors/search', { params: { query: params.query, limit: params.limit, threshold: params.threshold }, signal: params?.signal });
  }

}