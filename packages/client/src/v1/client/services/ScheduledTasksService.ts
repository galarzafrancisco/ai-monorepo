/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateScheduledTaskDto } from '../models/CreateScheduledTaskDto.js';
import type { ScheduledTaskListResponseDto } from '../models/ScheduledTaskListResponseDto.js';
import type { ScheduledTaskResponseDto } from '../models/ScheduledTaskResponseDto.js';
import type { UpdateScheduledTaskDto } from '../models/UpdateScheduledTaskDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ScheduledTasksService {
    /**
     * Create a new scheduled task
     * @param requestBody
     * @returns ScheduledTaskResponseDto Scheduled task created successfully
     * @throws ApiError
     */
    public static scheduledTasksControllerCreateScheduledTask(
        requestBody: CreateScheduledTaskDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ScheduledTaskResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/scheduled-tasks',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List all scheduled tasks
     * @param page Page number (1-indexed)
     * @param limit Number of items per page
     * @param enabled Filter by enabled status
     * @returns ScheduledTaskListResponseDto Scheduled tasks retrieved successfully
     * @throws ApiError
     */
    public static scheduledTasksControllerListScheduledTasks(
        page: number = 1,
        limit: number = 20,
        enabled?: boolean,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ScheduledTaskListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/scheduled-tasks',
            query: {
                'page': page,
                'limit': limit,
                'enabled': enabled,
            },
        });
    }
    /**
     * Get a scheduled task by ID
     * @param id Scheduled task ID
     * @returns ScheduledTaskResponseDto Scheduled task retrieved successfully
     * @throws ApiError
     */
    public static scheduledTasksControllerGetScheduledTask(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ScheduledTaskResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/scheduled-tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Scheduled task not found`,
            },
        });
    }
    /**
     * Update a scheduled task
     * @param id Scheduled task ID
     * @param requestBody
     * @returns ScheduledTaskResponseDto Scheduled task updated successfully
     * @throws ApiError
     */
    public static scheduledTasksControllerUpdateScheduledTask(
        id: string,
        requestBody: UpdateScheduledTaskDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ScheduledTaskResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/scheduled-tasks/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Scheduled task not found`,
            },
        });
    }
    /**
     * Delete a scheduled task
     * @param id Scheduled task ID
     * @returns void
     * @throws ApiError
     */
    public static scheduledTasksControllerDeleteScheduledTask(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/scheduled-tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Scheduled task not found`,
            },
        });
    }
}
