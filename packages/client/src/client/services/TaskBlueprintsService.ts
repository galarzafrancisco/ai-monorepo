/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateTaskBlueprintDto } from '../models/CreateTaskBlueprintDto.js';
import type { TaskBlueprintListResponseDto } from '../models/TaskBlueprintListResponseDto.js';
import type { TaskBlueprintResponseDto } from '../models/TaskBlueprintResponseDto.js';
import type { TaskResponseDto } from '../models/TaskResponseDto.js';
import type { UpdateTaskBlueprintDto } from '../models/UpdateTaskBlueprintDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class TaskBlueprintsService {
    /**
     * Create a new task blueprint
     * @param requestBody
     * @returns TaskBlueprintResponseDto Task blueprint created successfully
     * @throws ApiError
     */
    public static taskBlueprintsControllerCreateTaskBlueprint(
        requestBody: CreateTaskBlueprintDto,
    ): CancelablePromise<TaskBlueprintResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/task-blueprints',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List all task blueprints
     * @param page Page number (1-indexed)
     * @param limit Number of items per page
     * @returns TaskBlueprintListResponseDto Task blueprints retrieved successfully
     * @throws ApiError
     */
    public static taskBlueprintsControllerListTaskBlueprints(
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<TaskBlueprintListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/task-blueprints',
            query: {
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Get a task blueprint by ID
     * @param id Task blueprint ID
     * @returns TaskBlueprintResponseDto Task blueprint retrieved successfully
     * @throws ApiError
     */
    public static taskBlueprintsControllerGetTaskBlueprint(
        id: string,
    ): CancelablePromise<TaskBlueprintResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/task-blueprints/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Task blueprint not found`,
            },
        });
    }
    /**
     * Update a task blueprint
     * @param id Task blueprint ID
     * @param requestBody
     * @returns TaskBlueprintResponseDto Task blueprint updated successfully
     * @throws ApiError
     */
    public static taskBlueprintsControllerUpdateTaskBlueprint(
        id: string,
        requestBody: UpdateTaskBlueprintDto,
    ): CancelablePromise<TaskBlueprintResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/task-blueprints/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Task blueprint not found`,
            },
        });
    }
    /**
     * Delete a task blueprint
     * @param id Task blueprint ID
     * @returns void
     * @throws ApiError
     */
    public static taskBlueprintsControllerDeleteTaskBlueprint(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/task-blueprints/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Task blueprint not found`,
                409: `Task blueprint has active schedules`,
            },
        });
    }
    /**
     * Create a task from a blueprint
     * @param id Task blueprint ID
     * @returns TaskResponseDto Task created from blueprint successfully
     * @throws ApiError
     */
    public static taskBlueprintsControllerCreateTaskFromBlueprint(
        id: string,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/task-blueprints/{id}/create-task',
            path: {
                'id': id,
            },
            errors: {
                404: `Task blueprint not found`,
            },
        });
    }
}
