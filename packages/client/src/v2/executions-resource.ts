import { BaseClient, ClientConfig } from './base-client.js';
import type { ExecutionListResponseDto } from './types.js';

export class ExecutionsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List task executions with optional filtering and pagination */
  async ExecutionsController_listExecutions(params?: { status?: 'READY' | 'CLAIMED' | 'RUNNING' | 'STOP_REQUESTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE'; agentActorId?: string; taskId?: string; page?: number; limit?: number; signal?: AbortSignal }): Promise<ExecutionListResponseDto> {
    return this.request('GET', '/api/v1/executions', { params: { status: params?.status, agentActorId: params?.agentActorId, taskId: params?.taskId, page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

}