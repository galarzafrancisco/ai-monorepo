/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActiveTaskExecutionListResponseDto } from '../models/ActiveTaskExecutionListResponseDto.js';
import type { ActiveTaskExecutionResponseDto } from '../models/ActiveTaskExecutionResponseDto.js';
import type { StopActiveTaskExecutionDto } from '../models/StopActiveTaskExecutionDto.js';
import type { TaskExecutionHistoryListResponseDto } from '../models/TaskExecutionHistoryListResponseDto.js';
import type { TaskExecutionHistoryResponseDto } from '../models/TaskExecutionHistoryResponseDto.js';
import type { TaskExecutionQueueListResponseDto } from '../models/TaskExecutionQueueListResponseDto.js';
import type { UpdateExecutionStatsDto } from '../models/UpdateExecutionStatsDto.js';
import type { UpdateRunnerSessionIdDto } from '../models/UpdateRunnerSessionIdDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ExecutionsService {
    /**
     * List the current task execution work queue
     * Returns the tasks currently present in the execution queue with pagination. Presence means the task is ready to be picked by the executor.
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @returns TaskExecutionQueueListResponseDto
     * @throws ApiError
     */
    public static taskExecutionQueueControllerListQueue(
        page: number = 1,
        limit: number = 50,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskExecutionQueueListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/queue',
            query: {
                'page': page,
                'limit': limit,
            },
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
     * Returns the tasks currently being worked on in the execution system with pagination.
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @param taskId Filter by task ID
     * @returns ActiveTaskExecutionListResponseDto
     * @throws ApiError
     */
    public static activeTaskExecutionControllerListActiveExecutions(
        page: number = 1,
        limit: number = 50,
        taskId?: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ActiveTaskExecutionListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/active',
            query: {
                'page': page,
                'limit': limit,
                'taskId': taskId,
            },
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
     * Unclaim an active task execution and return it to the queue
     * Atomically removes the execution from the active execution table and returns its task to the execution queue. Only the worker that claimed the execution may unclaim it.
     * @param executionId Execution ID to unclaim
     * @returns void
     * @throws ApiError
     */
    public static activeTaskExecutionControllerUnclaimTaskExecution(
        executionId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/executions/active/{executionId}/unclaim',
            path: {
                'executionId': executionId,
            },
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
     * Patch execution stats and metadata
     * Atomically updates one or more execution metadata fields such as harness, model details, or token usage.
     * @param executionId Execution ID to update
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static activeTaskExecutionControllerUpdateExecutionStats(
        executionId: string,
        requestBody: UpdateExecutionStatsDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/executions/active/{executionId}/stats',
            path: {
                'executionId': executionId,
            },
            body: requestBody,
            mediaType: 'application/json',
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
     * Returns the persisted execution history rows in the execution system with pagination.
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @param taskId Filter by task ID
     * @returns TaskExecutionHistoryListResponseDto
     * @throws ApiError
     */
    public static taskExecutionHistoryControllerListHistory(
        page: number = 1,
        limit: number = 50,
        taskId?: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskExecutionHistoryListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions/history',
            query: {
                'page': page,
                'limit': limit,
                'taskId': taskId,
            },
        });
    }
}
