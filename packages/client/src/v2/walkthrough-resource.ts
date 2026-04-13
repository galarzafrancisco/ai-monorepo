import { BaseClient, ClientConfig } from './base-client.js';
import type { UserWalkthroughStatusResponseDto } from './types.js';

export class WalkthroughResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Acknowledge walkthrough — transitions FULL_PAGE display mode to BANNER */
  async WalkthroughController_acknowledge(params?: { signal?: AbortSignal }): Promise<{ ok: boolean }> {
    return this.request('POST', '/api/v1/walkthrough/acknowledge', { signal: params?.signal });
  }

  /** Get walkthrough status for the current user */
  async WalkthroughController_getStatus(params?: { signal?: AbortSignal }): Promise<UserWalkthroughStatusResponseDto> {
    return this.request('GET', '/api/v1/walkthrough/status', { signal: params?.signal });
  }

}