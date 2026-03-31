import { BaseClient, ClientConfig } from './base-client.js';
import type { AppendBlockDto, BlockListResponseDto, BlockResponseDto, BlockSearchResultDto, BlockTreeResponseDto, CreateBlockDto, CreateTagDto, MoveBlockDto, ReorderBlockDto, UpdateBlockDto } from './types.js';

export class ContextResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new wiki page */
  async ContextController_createBlock(params: { body: CreateBlockDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('POST', '/api/v1/context/blocks', { body: params.body, signal: params?.signal });
  }

  /** List wiki pages without content */
  async ContextController_listBlocks(params?: { tag?: string; signal?: AbortSignal }): Promise<BlockListResponseDto> {
    return this.request('GET', '/api/v1/context/blocks', { params: { tag: params?.tag }, signal: params?.signal });
  }

  /** Search blocks by query string */
  async ContextController_searchBlocks(params: { query: string; limit?: number; threshold?: number; signal?: AbortSignal }): Promise<BlockSearchResultDto[]> {
    return this.request('GET', '/api/v1/context/blocks/search/query', { params: { query: params.query, limit: params.limit, threshold: params.threshold }, signal: params?.signal });
  }

  /** Get page hierarchy tree */
  async ContextController_getBlockTree(params?: { signal?: AbortSignal }): Promise<BlockTreeResponseDto[]> {
    return this.request('GET', '/api/v1/context/blocks/tree', { signal: params?.signal });
  }

  /** Fetch a wiki page by ID */
  async ContextController_getBlock(params: { id: string; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('GET', `/api/v1/context/blocks/${params.id}`, { signal: params?.signal });
  }

  /** Update an existing wiki page */
  async ContextController_updateBlock(params: { id: string; body: UpdateBlockDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('PATCH', `/api/v1/context/blocks/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a wiki page */
  async ContextController_deleteBlock(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/context/blocks/${params.id}`, { signal: params?.signal });
  }

  /** Append content to an existing wiki page */
  async ContextController_appendToBlock(params: { id: string; body: AppendBlockDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('POST', `/api/v1/context/blocks/${params.id}/append`, { body: params.body, signal: params?.signal });
  }

  /** Reorder a page within siblings */
  async ContextController_reorderBlock(params: { id: string; body: ReorderBlockDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('PATCH', `/api/v1/context/blocks/${params.id}/reorder`, { body: params.body, signal: params?.signal });
  }

  /** Move page to different parent */
  async ContextController_moveBlock(params: { id: string; body: MoveBlockDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('PATCH', `/api/v1/context/blocks/${params.id}/move`, { body: params.body, signal: params?.signal });
  }

  /** Add a tag to a wiki page */
  async ContextController_addTagToBlock(params: { id: string; body: CreateTagDto; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('POST', `/api/v1/context/blocks/${params.id}/tags`, { body: params.body, signal: params?.signal });
  }

  /** Remove a tag from a wiki page */
  async ContextController_removeTagFromBlock(params: { id: string; tagId: string; signal?: AbortSignal }): Promise<BlockResponseDto> {
    return this.request('DELETE', `/api/v1/context/blocks/${params.id}/tags/${params.tagId}`, { signal: params?.signal });
  }

  async ContextController_handleMcp_get(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('GET', '/api/v1/context/blocks/mcp', { signal: params?.signal });
  }

  async ContextController_handleMcp_post(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('POST', '/api/v1/context/blocks/mcp', { signal: params?.signal });
  }

  async ContextController_handleMcp_put(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('PUT', '/api/v1/context/blocks/mcp', { signal: params?.signal });
  }

  async ContextController_handleMcp_delete(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', '/api/v1/context/blocks/mcp', { signal: params?.signal });
  }

  async ContextController_handleMcp_patch(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', '/api/v1/context/blocks/mcp', { signal: params?.signal });
  }

}