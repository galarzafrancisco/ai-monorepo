import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateAccessRequestDto, CreateAccessRequestResponseDto } from './types.js';

export class AccessRequestsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Public: express interest in Taico access (write-only) */
  async AccessRequestsController_create(params: { body: CreateAccessRequestDto; signal?: AbortSignal }): Promise<CreateAccessRequestResponseDto> {
    return this.request('POST', '/api/v1/access-requests', { body: params.body, signal: params?.signal });
  }

}