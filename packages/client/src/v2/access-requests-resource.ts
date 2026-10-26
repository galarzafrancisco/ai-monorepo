import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateAccessRequestDto, CreateAccessRequestResponseDto } from './types.js';

export class AccessRequestsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Public: express interest in access (write-only) */
  async AccessRequestsController_create(params: { body: CreateAccessRequestDto; signal?: AbortSignal }): Promise<void> {
    return this.request('POST', '/api/v1/access-requests', { body: params.body, responseType: 'void', signal: params?.signal });
  }

}