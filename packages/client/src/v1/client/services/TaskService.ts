/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AnswerInputRequestDto } from '../models/AnswerInputRequestDto.js';
import type { ArtefactResponseDto } from '../models/ArtefactResponseDto.js';
import type { AssignTaskDto } from '../models/AssignTaskDto.js';
import type { ChangeTaskStatusDto } from '../models/ChangeTaskStatusDto.js';
import type { CommentResponseDto } from '../models/CommentResponseDto.js';
import type { CreateArtefactDto } from '../models/CreateArtefactDto.js';
import type { CreateCommentDto } from '../models/CreateCommentDto.js';
import type { CreateInputRequestDto } from '../models/CreateInputRequestDto.js';
import type { CreateTagDto } from '../models/CreateTagDto.js';
import type { CreateTaskDto } from '../models/CreateTaskDto.js';
import type { InputRequestResponseDto } from '../models/InputRequestResponseDto.js';
import type { TaskListResponseDto } from '../models/TaskListResponseDto.js';
import type { TaskResponseDto } from '../models/TaskResponseDto.js';
import type { TaskSearchResultDto } from '../models/TaskSearchResultDto.js';
import type { UpdateTaskDto } from '../models/UpdateTaskDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class TaskService {
    /**
     * Create a new task
     * @param requestBody
     * @returns TaskResponseDto Task created successfully
     * @throws ApiError
     */
    public static tasksControllerCreateTask(
        requestBody: CreateTaskDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskListResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
     * Assign a task to the current user
     * @param id Task UUID
     * @returns TaskResponseDto Task assigned to current user successfully
     * @throws ApiError
     */
    public static tasksControllerAssignTaskToMe(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/{id}/assign-to-me',
            path: {
                'id': id,
            },
            errors: {
                404: `Task not found`,
            },
        });
    }
    /**
     * Search tasks by query string
     * @param query Search query string
     * @param limit Maximum number of results to return
     * @param threshold Minimum score threshold (0-1, higher is stricter)
     * @returns TaskSearchResultDto Search results sorted by relevance
     * @throws ApiError
     */
    public static tasksControllerSearchTasks(
        query: string,
        limit: number = 10,
        threshold: number = 0.3,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<TaskSearchResultDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/tasks/tasks/search/query',
            query: {
                'query': query,
                'limit': limit,
                'threshold': threshold,
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<CommentResponseDto> {
        return __request(config, {
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
     * Add an artefact to a task
     * @param id Task UUID
     * @param requestBody
     * @returns ArtefactResponseDto Artefact added successfully
     * @throws ApiError
     */
    public static tasksControllerAddArtefact(
        id: string,
        requestBody: CreateArtefactDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ArtefactResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/{id}/artefacts',
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
        requestBody: CreateTagDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<TaskResponseDto> {
        return __request(config, {
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
     * Create an input request for a task
     * @param id Task UUID
     * @param requestBody
     * @returns InputRequestResponseDto Input request created successfully
     * @throws ApiError
     */
    public static tasksControllerCreateInputRequest(
        id: string,
        requestBody: CreateInputRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<InputRequestResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/{id}/input-requests',
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
     * Answer an input request
     * @param id
     * @param inputRequestId
     * @param requestBody
     * @returns InputRequestResponseDto Input request answered successfully
     * @throws ApiError
     */
    public static tasksControllerAnswerInputRequest(
        id: string,
        inputRequestId: string,
        requestBody: AnswerInputRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<InputRequestResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/{id}/input-requests/{inputRequestId}/answer',
            path: {
                'id': id,
                'inputRequestId': inputRequestId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Input request not found`,
            },
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpGet(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPost(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPut(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'PUT',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpDelete(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpPatch(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpOptions(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'OPTIONS',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static tasksControllerHandleMcpHead(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'HEAD',
            url: '/api/v1/tasks/tasks/mcp',
        });
    }
}
