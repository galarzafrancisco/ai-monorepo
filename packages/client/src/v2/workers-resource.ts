import { BaseClient, ClientConfig } from './base-client.js';
import type { WorkerResponseDto } from './types.js';

export class WorkersResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List all workers */
  async WorkersController_listWorkers(params?: { signal?: AbortSignal }): Promise<WorkerResponseDto[]> {
    return this.request('GET', '/api/v1/workers', { signal: params?.signal });
  }

}