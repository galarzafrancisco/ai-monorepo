import { BaseClient, ClientConfig } from './base-client.js';
import type { GlobalSearchResultDto, SearchIndexStatusDto, SearchResultType, SearchSettingsDto, UpdateSearchSettingsDto } from './types.js';

export class SearchResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Global search across all resources */
  async GlobalSearchController_search(params: { query: string; limit?: number; types?: SearchResultType[]; signal?: AbortSignal }): Promise<GlobalSearchResultDto[]> {
    return this.request('GET', '/api/v1/search/query', { params: { query: params.query, limit: params.limit, types: params.types }, signal: params?.signal });
  }

  /** Get the search settings */
  async SearchAdminController_getSearchSettings(params?: { signal?: AbortSignal }): Promise<SearchSettingsDto> {
    return this.request('GET', '/api/v1/search/settings', { signal: params?.signal });
  }

  /** Change search settings */
  async SearchAdminController_updateSearchSettings(params: { body: UpdateSearchSettingsDto; signal?: AbortSignal }): Promise<SearchSettingsDto> {
    return this.request('PATCH', '/api/v1/search/settings', { body: params.body, signal: params?.signal });
  }

  /** Reset the search settings to their defaults */
  async SearchAdminController_resetSearchSettings(params?: { signal?: AbortSignal }): Promise<SearchSettingsDto> {
    return this.request('DELETE', '/api/v1/search/settings', { signal: params?.signal });
  }

  /** Get the state of the search index */
  async SearchAdminController_getSearchIndexStatus(params?: { signal?: AbortSignal }): Promise<SearchIndexStatusDto> {
    return this.request('GET', '/api/v1/search/index', { signal: params?.signal });
  }

  /** Rebuild the search index */
  async SearchAdminController_rebuildSearchIndex(params?: { signal?: AbortSignal }): Promise<SearchIndexStatusDto> {
    return this.request('POST', '/api/v1/search/index/rebuild', { signal: params?.signal });
  }

}