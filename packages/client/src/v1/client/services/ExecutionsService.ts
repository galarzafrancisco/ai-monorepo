/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExecutionListResponseDto } from '../models/ExecutionListResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ExecutionsService {
    /**
     * List task executions with optional filtering and pagination
     * Returns the backend-tracked work queue showing all TaskExecution records. Useful for debugging the execution reconciler and understanding which tasks are ready to run.
     * @param status Filter by execution status
     * @param agentActorId Filter by agent actor ID
     * @param taskId Filter by task ID
     * @param page Page number (1-indexed)
     * @param limit Number of items per page
     * @returns ExecutionListResponseDto
     * @throws ApiError
     */
    public static executionsControllerListExecutions(
        status?: 'READY' | 'CLAIMED' | 'RUNNING' | 'STOP_REQUESTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE',
        agentActorId?: string,
        taskId?: string,
        page?: number,
        limit?: number,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ExecutionListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/executions',
            query: {
                'status': status,
                'agentActorId': agentActorId,
                'taskId': taskId,
                'page': page,
                'limit': limit,
            },
        });
    }
}
