/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActiveTaskExecutionResponseDto } from '../models/ActiveTaskExecutionResponseDto.js';
import type { StopActiveTaskExecutionDto } from '../models/StopActiveTaskExecutionDto.js';
import type { TaskExecutionHistoryResponseDto } from '../models/TaskExecutionHistoryResponseDto.js';
import type { TaskExecutionQueueEntryResponseDto } from '../models/TaskExecutionQueueEntryResponseDto.js';
import type { UpdateRunnerSessionIdDto } from '../models/UpdateRunnerSessionIdDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ExecutionsService {
    /**
     * List the current task execution work queue
     * Returns the tasks currently present in the execution queue. Presence means the task is ready to be picked by the executor.
     * @returns TaskExecutionQueueEntryResponseDto
     * @throws ApiError
     */
    public static taskExecutionQueueControllerListQueue(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<TaskExecutionQueueEntryResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/queue',
        });
    }
    /**
     * Claim a specific task from the execution queue
     * Atomically removes the task from the queue and inserts it into the active execution table.
     * @param taskId Task ID to claim
     * @returns ActiveTaskExecutionResponseDto
     * @throws ApiError
     */
    public static taskExecutionQueueControllerClaimTask(
        taskId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ActiveTaskExecutionResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/executions/queue/{taskId}/claim',
            path: {
                'taskId': taskId,
            },
        });
    }
    /**
     * List active task executions
     * Returns the tasks currently being worked on in the execution system.
     * @returns ActiveTaskExecutionResponseDto
     * @throws ApiError
     */
    public static activeTaskExecutionControllerListActiveExecutions(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<ActiveTaskExecutionResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/active',
        });
    }
    /**
     * Stop an active task execution and move it to history
     * Atomically removes the execution from the active execution table and inserts it into the history table.
     * @param executionId Execution ID to stop
     * @param requestBody
     * @returns TaskExecutionHistoryResponseDto
     * @throws ApiError
     */
    public static activeTaskExecutionControllerStopTaskExecution(
        executionId: string,
        requestBody: StopActiveTaskExecutionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskExecutionHistoryResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/executions/active/{executionId}/stop',
            path: {
                'executionId': executionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Attach the runner session id to an active execution
     * Stores the runtime session identifier emitted by the agent harness so it can be propagated to execution history.
     * @param executionId Execution ID to update
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static activeTaskExecutionControllerUpdateRunnerSessionId(
        executionId: string,
        requestBody: UpdateRunnerSessionIdDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/executions/active/{executionId}/session',
            path: {
                'executionId': executionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Increment tool call count for an active execution
     * Atomically increments the active execution tool-call counter without touching other mutable execution fields.
     * @param executionId Execution ID to update
     * @returns void
     * @throws ApiError
     */
    public static activeTaskExecutionControllerIncrementToolCallCount(
        executionId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/executions/active/{executionId}/tool-calls/increment',
            path: {
                'executionId': executionId,
            },
        });
    }
    /**
     * Request interruption of an active execution
     * Signals the worker to abort the currently running agent execution.
     * @param executionId Execution ID to interrupt
     * @returns void
     * @throws ApiError
     */
    public static activeTaskExecutionControllerInterruptExecution(
        executionId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/executions/active/{executionId}/interrupt',
            path: {
                'executionId': executionId,
            },
        });
    }
    /**
     * List task execution history
     * Returns the persisted execution history rows in the execution system.
     * @returns TaskExecutionHistoryResponseDto
     * @throws ApiError
     */
    public static taskExecutionHistoryControllerListHistory(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<TaskExecutionHistoryResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/history',
        });
    }
}
