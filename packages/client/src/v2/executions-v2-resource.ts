import { BaseClient, ClientConfig } from './base-client.js';
import type { ActiveTaskExecutionResponseDto, StopActiveTaskExecutionDto, TaskExecutionHistoryResponseDto, TaskExecutionQueueEntryResponseDto, UpdateRunnerSessionIdDto } from './types.js';

export class ExecutionsV2Resource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List the current task execution work queue */
  async TaskExecutionQueueController_listQueue(params?: { signal?: AbortSignal }): Promise<TaskExecutionQueueEntryResponseDto[]> {
    return this.request('GET', '/api/v1/executions-v2/queue', { signal: params?.signal });
  }

  /** Claim a specific task from the execution queue */
  async TaskExecutionQueueController_claimTask(params: { taskId: string; signal?: AbortSignal }): Promise<ActiveTaskExecutionResponseDto> {
    return this.request('POST', `/api/v1/executions-v2/queue/${params.taskId}/claim`, { signal: params?.signal });
  }

  /** List active task executions */
  async ActiveTaskExecutionController_listActiveExecutions(params?: { signal?: AbortSignal }): Promise<ActiveTaskExecutionResponseDto[]> {
    return this.request('GET', '/api/v1/executions-v2/active', { signal: params?.signal });
  }

  /** Stop an active task execution and move it to history */
  async ActiveTaskExecutionController_stopTaskExecution(params: { executionId: string; body: StopActiveTaskExecutionDto; signal?: AbortSignal }): Promise<TaskExecutionHistoryResponseDto> {
    return this.request('POST', `/api/v1/executions-v2/active/${params.executionId}/stop`, { body: params.body, signal: params?.signal });
  }

  /** Attach the runner session id to an active execution */
  async ActiveTaskExecutionController_updateRunnerSessionId(params: { executionId: string; body: UpdateRunnerSessionIdDto; signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', `/api/v1/executions-v2/active/${params.executionId}/session`, { body: params.body, signal: params?.signal });
  }

  /** Increment tool call count for an active execution */
  async ActiveTaskExecutionController_incrementToolCallCount(params: { executionId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', `/api/v1/executions-v2/active/${params.executionId}/tool-calls/increment`, { signal: params?.signal });
  }

  /** List task execution history */
  async TaskExecutionHistoryController_listHistory(params?: { signal?: AbortSignal }): Promise<TaskExecutionHistoryResponseDto[]> {
    return this.request('GET', '/api/v1/executions-v2/history', { signal: params?.signal });
  }

}