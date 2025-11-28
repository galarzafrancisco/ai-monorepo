/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddTagDto } from '../models/AddTagDto';
import type { AssignTaskDto } from '../models/AssignTaskDto';
import type { ChangeTaskStatusDto } from '../models/ChangeTaskStatusDto';
import type { CommentResponseDto } from '../models/CommentResponseDto';
import type { CreateCommentDto } from '../models/CreateCommentDto';
import type { CreateTaskDto } from '../models/CreateTaskDto';
import type { TagResponseDto } from '../models/TagResponseDto';
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
     * @param tag Filter tasks by tag name
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @returns TaskListResponseDto Paginated list of tasks
     * @throws ApiError
     */
    public static taskerooControllerListTasks(
        assignee?: string,
        sessionId?: string,
        tag?: string,
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<TaskListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/taskeroo/tasks',
            query: {
                'assignee': assignee,
                'sessionId': sessionId,
                'tag': tag,
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
        requestBody: ChangeTaskStatusDto,
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
    /**
     * Add a tag to a task
     * @param id Task UUID
     * @param requestBody
     * @returns TaskResponseDto Tag added to task successfully
     * @throws ApiError
     */
    public static taskerooControllerAddTagToTask(
        id: string,
        requestBody: AddTagDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/taskeroo/tasks/{id}/tags',
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
     * Remove a tag from a task
     * @param id
     * @param tagId
     * @returns TaskResponseDto Tag removed from task successfully
     * @throws ApiError
     */
    public static taskerooControllerRemoveTagFromTask(
        id: string,
        tagId: string,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/taskeroo/tasks/{id}/tags/{tagId}',
            path: {
                'id': id,
                'tagId': tagId,
            },
            errors: {
                404: `Task not found`,
            },
        });
    }
    /**
     * Get all tags
     * @returns TagResponseDto List of all tags
     * @throws ApiError
     */
    public static taskerooControllerGetAllTags(): CancelablePromise<Array<TagResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/taskeroo/tasks/tags/all',
        });
    }
    /**
     * Delete a tag from the system
     * @param tagId
     * @returns void
     * @throws ApiError
     */
    public static taskerooControllerDeleteTag(
        tagId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/taskeroo/tasks/tags/{tagId}',
            path: {
                'tagId': tagId,
            },
            errors: {
                404: `Tag not found`,
            },
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpPut(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpDelete(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpPatch(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpOptions(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'OPTIONS',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static taskerooControllerHandleMcpHead(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'HEAD',
            url: '/api/v1/taskeroo/tasks/mcp',
        });
    }
}
