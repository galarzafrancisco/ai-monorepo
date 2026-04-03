/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActiveTaskExecutionResponseDto } from '../models/ActiveTaskExecutionResponseDto.js';
import type { StopActiveTaskExecutionDto } from '../models/StopActiveTaskExecutionDto.js';
import type { TaskExecutionHistoryResponseDto } from '../models/TaskExecutionHistoryResponseDto.js';
import type { TaskExecutionQueueEntryResponseDto } from '../models/TaskExecutionQueueEntryResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ExecutionsV2Service {
    /**
     * List the current task execution work queue
     * Returns the tasks currently present in the v2 execution queue. Presence means the task is ready to be picked by the executor.
     * @returns TaskExecutionQueueEntryResponseDto
     * @throws ApiError
     */
    public static taskExecutionQueueControllerListQueue(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<TaskExecutionQueueEntryResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions-v2/queue',
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
            url: '/api/v1/executions-v2/queue/{taskId}/claim',
            path: {
                'taskId': taskId,
            },
        });
    }
    /**
     * List active task executions
     * Returns the tasks currently being worked on in the v2 execution system.
     * @returns ActiveTaskExecutionResponseDto
     * @throws ApiError
     */
    public static activeTaskExecutionControllerListActiveExecutions(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<ActiveTaskExecutionResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions-v2/active',
        });
    }
    /**
     * Stop an active task execution and move it to history
     * Atomically removes the task from the active execution table and inserts it into the history table.
     * @param taskId Task ID to stop
     * @param requestBody
     * @returns TaskExecutionHistoryResponseDto
     * @throws ApiError
     */
    public static activeTaskExecutionControllerStopTaskExecution(
        taskId: string,
        requestBody: StopActiveTaskExecutionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskExecutionHistoryResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/executions-v2/active/{taskId}/stop',
            path: {
                'taskId': taskId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List task execution history
     * Returns the persisted execution history rows in the v2 execution system.
     * @returns TaskExecutionHistoryResponseDto
     * @throws ApiError
     */
    public static taskExecutionHistoryControllerListHistory(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<TaskExecutionHistoryResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions-v2/history',
        });
    }
}
