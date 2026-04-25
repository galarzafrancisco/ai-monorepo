import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateTagDto, MetaTagResponseDto, VersionResponseDto } from './types.js';

export class MetaResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new tag */
  async MetaController_createTag(params: { body: CreateTagDto; signal?: AbortSignal }): Promise<MetaTagResponseDto> {
    return this.request('POST', '/api/v1/meta/tags', { body: params.body, signal: params?.signal });
  }

  /** Get all tags */
  async MetaController_getAllTags(params?: { signal?: AbortSignal }): Promise<MetaTagResponseDto[]> {
    return this.request('GET', '/api/v1/meta/tags', { signal: params?.signal });
  }

  /** Get available tag colors */
  async MetaController_getTagColors(params?: { signal?: AbortSignal }): Promise<string[]> {
    return this.request('GET', '/api/v1/meta/tags/colors', { signal: params?.signal });
  }

  /** Delete a tag from the system */
  async MetaController_deleteTag(params: { tagId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/meta/tags/${params.tagId}`, { responseType: 'void', signal: params?.signal });
  }

  /** Get version information */
  async MetaController_getVersion(params?: { signal?: AbortSignal }): Promise<VersionResponseDto> {
    return this.request('GET', '/api/v1/meta/version', { signal: params?.signal });
  }

}