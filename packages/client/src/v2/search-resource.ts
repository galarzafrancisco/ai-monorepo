import { BaseClient, ClientConfig } from './base-client.js';
import type { GlobalSearchResultDto } from './types.js';

export class SearchResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Global search across all resources */
  async GlobalSearchController_search(params: { query: string; limit?: number; threshold?: number; signal?: AbortSignal }): Promise<GlobalSearchResultDto[]> {
    return this.request('GET', '/api/v1/search/query', { params: { query: params.query, limit: params.limit, threshold: params.threshold }, signal: params?.signal });
  }

}