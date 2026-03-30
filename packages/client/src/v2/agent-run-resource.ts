import { BaseClient, ClientConfig } from './base-client.js';
import type { AgentRunListResponseDto, AgentRunResponseDto, CreateAgentRunDto, UpdateAgentRunDto } from './types.js';

export class AgentrunResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new agent run */
  async AgentRunsController_createAgentRun(params: { body: CreateAgentRunDto; signal?: AbortSignal }): Promise<AgentRunResponseDto> {
    return this.request('POST', '/api/v1/agent-runs', { body: params.body, signal: params?.signal });
  }

  /** List agent runs with optional filters */
  async AgentRunsController_listAgentRuns(params?: { actorId?: string; parentTaskId?: string; page?: number; limit?: number; signal?: AbortSignal }): Promise<AgentRunListResponseDto> {
    return this.request('GET', '/api/v1/agent-runs', { params: { actorId: params?.actorId, parentTaskId: params?.parentTaskId, page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** Get an agent run by ID */
  async AgentRunsController_getAgentRunById(params: { runId: string; signal?: AbortSignal }): Promise<AgentRunResponseDto> {
    return this.request('GET', `/api/v1/agent-runs/${params.runId}`, { signal: params?.signal });
  }

  /** Update an agent run */
  async AgentRunsController_updateAgentRun(params: { runId: string; body: UpdateAgentRunDto; signal?: AbortSignal }): Promise<AgentRunResponseDto> {
    return this.request('PATCH', `/api/v1/agent-runs/${params.runId}`, { body: params.body, signal: params?.signal });
  }

}