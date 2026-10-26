import { BaseClient, ClientConfig } from './base-client.js';
import type { AccessRequestListResponseDto, AccessRequestResponseDto, AccessRequestStatus, UpdateAccessRequestDto } from './types.js';

export class AccessRequestsAdminResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Admin: list access requests, most recently submitted first */
  async AccessRequestsAdminController_list(params?: { status?: AccessRequestStatus; search?: string; limit?: number; offset?: number; signal?: AbortSignal }): Promise<AccessRequestListResponseDto> {
    return this.request('GET', '/api/v1/admin/access-requests', { params: { status: params?.status, search: params?.search, limit: params?.limit, offset: params?.offset }, signal: params?.signal });
  }

  /** Admin: mark an access request new or reviewed */
  async AccessRequestsAdminController_update(params: { id: string; body: UpdateAccessRequestDto; signal?: AbortSignal }): Promise<AccessRequestResponseDto> {
    return this.request('PATCH', `/api/v1/admin/access-requests/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Admin: delete an access request */
  async AccessRequestsAdminController_remove(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/admin/access-requests/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

}