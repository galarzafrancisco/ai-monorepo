import { BaseClient, ClientConfig } from './base-client.js';
import type { ActiveTaskExecutionResponseDto, StopActiveTaskExecutionDto, TaskExecutionHistoryResponseDto, TaskExecutionQueueEntryResponseDto, UpdateExecutionStatsDto, UpdateRunnerSessionIdDto } from './types.js';

export class ExecutionsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List the current task execution work queue */
  async TaskExecutionQueueController_listQueue(params?: { signal?: AbortSignal }): Promise<TaskExecutionQueueEntryResponseDto[]> {
    return this.request('GET', '/api/v1/executions/queue', { signal: params?.signal });
  }

  /** Claim a specific task from the execution queue */
  async TaskExecutionQueueController_claimTask(params: { taskId: string; signal?: AbortSignal }): Promise<ActiveTaskExecutionResponseDto> {
    return this.request('POST', `/api/v1/executions/queue/${params.taskId}/claim`, { signal: params?.signal });
  }

  /** List active task executions */
  async ActiveTaskExecutionController_listActiveExecutions(params?: { signal?: AbortSignal }): Promise<ActiveTaskExecutionResponseDto[]> {
    return this.request('GET', '/api/v1/executions/active', { signal: params?.signal });
  }

  /** Stop an active task execution and move it to history */
  async ActiveTaskExecutionController_stopTaskExecution(params: { executionId: string; body: StopActiveTaskExecutionDto; signal?: AbortSignal }): Promise<TaskExecutionHistoryResponseDto> {
    return this.request('POST', `/api/v1/executions/active/${params.executionId}/stop`, { body: params.body, signal: params?.signal });
  }

  /** Attach the runner session id to an active execution */
  async ActiveTaskExecutionController_updateRunnerSessionId(params: { executionId: string; body: UpdateRunnerSessionIdDto; signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', `/api/v1/executions/active/${params.executionId}/session`, { body: params.body, responseType: 'void', signal: params?.signal });
  }

  /** Increment tool call count for an active execution */
  async ActiveTaskExecutionController_incrementToolCallCount(params: { executionId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', `/api/v1/executions/active/${params.executionId}/tool-calls/increment`, { responseType: 'void', signal: params?.signal });
  }

  /** Patch execution stats and metadata */
  async ActiveTaskExecutionController_updateExecutionStats(params: { executionId: string; body: UpdateExecutionStatsDto; signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', `/api/v1/executions/active/${params.executionId}/stats`, { body: params.body, responseType: 'void', signal: params?.signal });
  }

  /** Request interruption of an active execution */
  async ActiveTaskExecutionController_interruptExecution(params: { executionId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('POST', `/api/v1/executions/active/${params.executionId}/interrupt`, { responseType: 'void', signal: params?.signal });
  }

  /** List task execution history */
  async TaskExecutionHistoryController_listHistory(params?: { signal?: AbortSignal }): Promise<TaskExecutionHistoryResponseDto[]> {
    return this.request('GET', '/api/v1/executions/history', { signal: params?.signal });
  }

}