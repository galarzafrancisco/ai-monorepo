/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AssignTaskDto } from '../models/AssignTaskDto';
import type { CommentResponseDto } from '../models/CommentResponseDto';
import type { CreateCommentDto } from '../models/CreateCommentDto';
import type { CreateTaskDto } from '../models/CreateTaskDto';
import type { TaskChangeStatusDto } from '../models/TaskChangeStatusDto';
import type { TaskListResponseDto } from '../models/TaskListResponseDto';
import type { TaskResponseDto } from '../models/TaskResponseDto';
import type { UpdateTaskDto } from '../models/UpdateTaskDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TaskService {
    /**
     * Create a new task
     * @param requestBody
     * @returns TaskResponseDto Task created successfully
     * @throws ApiError
     */
    public static taskerooControllerCreateTask(
        requestBody: CreateTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/taskeroo/tasks',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List tasks with optional filtering and pagination
     * @param assignee Filter tasks by assignee name
     * @param sessionId Filter tasks by session ID
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @returns TaskListResponseDto Paginated list of tasks
     * @throws ApiError
     */
    public static taskerooControllerListTasks(
        assignee?: string,
        sessionId?: string,
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<TaskListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/taskeroo/tasks',
            query: {
                'assignee': assignee,
                'sessionId': sessionId,
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Update task description
     * @param id Task UUID
     * @param requestBody
     * @returns TaskResponseDto Task updated successfully
     * @throws ApiError
     */
    public static taskerooControllerUpdateTask(
        id: string,
        requestBody: UpdateTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/taskeroo/tasks/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Task not found`,
            },
        });
    }
    /**
     * Delete a task
     * @param id Task UUID
     * @returns void
     * @throws ApiError
     */
    public static taskerooControllerDeleteTask(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/taskeroo/tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Task not found`,
            },
        });
    }
    /**
     * Get a task by ID
     * @param id Task UUID
     * @returns TaskResponseDto Task found
     * @throws ApiError
     */
    public static taskerooControllerGetTask(
        id: string,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/taskeroo/tasks/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Task not found`,
            },
        });
    }
    /**
     * Assign a task to someone
     * @param id Task UUID
     * @param requestBody
     * @returns TaskResponseDto Task assigned successfully
     * @throws ApiError
     */
    public static taskerooControllerAssignTask(
        id: string,
        requestBody: AssignTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/taskeroo/tasks/{id}/assign',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Task not found`,
            },
        });
    }
    /**
     * Add a comment to a task
     * @param id Task UUID
     * @param requestBody
     * @returns CommentResponseDto Comment added successfully
     * @throws ApiError
     */
    public static taskerooControllerAddComment(
        id: string,
        requestBody: CreateCommentDto,
    ): CancelablePromise<CommentResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/taskeroo/tasks/{id}/comments',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Task not found`,
            },
        });
    }
    /**
     * Change task status
     * @param id Task UUID
     * @param requestBody
     * @returns TaskResponseDto Status changed successfully
     * @throws ApiError
     */
    public static taskerooControllerChangeStatus(
        id: string,
        requestBody: TaskChangeStatusDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/taskeroo/tasks/{id}/status',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid status transition or comment required`,
                404: `Task not found`,
            },
        });
    }
}
