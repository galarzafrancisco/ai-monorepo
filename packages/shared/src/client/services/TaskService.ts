/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddTagDto } from '../models/AddTagDto';
import type { AssignTaskDto } from '../models/AssignTaskDto';
import type { ChangeTaskStatusDto } from '../models/ChangeTaskStatusDto';
import type { CommentResponseDto } from '../models/CommentResponseDto';
import type { CreateCommentDto } from '../models/CreateCommentDto';
import type { CreateTagDto } from '../models/CreateTagDto';
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
    public static tasksControllerCreateTask(
        requestBody: CreateTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tasks/tasks',
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
    public static tasksControllerListTasks(
        assignee?: string,
        sessionId?: string,
        tag?: string,
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<TaskListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tasks/tasks',
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
    public static tasksControllerUpdateTask(
        id: string,
        requestBody: UpdateTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/{id}',
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
    public static tasksControllerDeleteTask(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tasks/tasks/{id}',
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
    public static tasksControllerGetTask(
        id: string,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tasks/tasks/{id}',
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
    public static tasksControllerAssignTask(
        id: string,
        requestBody: AssignTaskDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/{id}/assign',
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
    public static tasksControllerAddComment(
        id: string,
        requestBody: CreateCommentDto,
    ): CancelablePromise<CommentResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/{id}/comments',
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
    public static tasksControllerChangeStatus(
        id: string,
        requestBody: ChangeTaskStatusDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/{id}/status',
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
    public static tasksControllerAddTagToTask(
        id: string,
        requestBody: AddTagDto,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/{id}/tags',
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
    public static tasksControllerRemoveTagFromTask(
        id: string,
        tagId: string,
    ): CancelablePromise<TaskResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tasks/tasks/{id}/tags/{tagId}',
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
     * Create a new tag
     * @param requestBody
     * @returns TagResponseDto Tag created successfully
     * @throws ApiError
     */
    public static tasksControllerCreateTag(
        requestBody: CreateTagDto,
    ): CancelablePromise<TagResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/tags',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * Get all tags
     * @returns TagResponseDto List of all tags
     * @throws ApiError
     */
    public static tasksControllerGetAllTags(): CancelablePromise<Array<TagResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tasks/tasks/tags/all',
        });
    }
    /**
     * Delete a tag from the system
     * @param tagId
     * @returns void
     * @throws ApiError
     */
    public static tasksControllerDeleteTag(
        tagId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tasks/tasks/tags/{tagId}',
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
    public static tasksControllerHandleMcpGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPut(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpDelete(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPatch(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpOptions(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'OPTIONS',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpHead(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'HEAD',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
}
