/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddParticipantDto } from '../models/AddParticipantDto.js';
import type { AppendThreadStateDto } from '../models/AppendThreadStateDto.js';
import type { AttachTaskDto } from '../models/AttachTaskDto.js';
import type { CreateTagDto } from '../models/CreateTagDto.js';
import type { CreateThreadDto } from '../models/CreateThreadDto.js';
import type { CreateThreadMessageDto } from '../models/CreateThreadMessageDto.js';
import type { ListThreadMessagesResponseDto } from '../models/ListThreadMessagesResponseDto.js';
import type { ReferenceContextBlockDto } from '../models/ReferenceContextBlockDto.js';
import type { ThreadListResponseDto } from '../models/ThreadListResponseDto.js';
import type { ThreadMessageResponseDto } from '../models/ThreadMessageResponseDto.js';
import type { ThreadResponseDto } from '../models/ThreadResponseDto.js';
import type { ThreadStateResponseDto } from '../models/ThreadStateResponseDto.js';
import type { UpdateThreadDto } from '../models/UpdateThreadDto.js';
import type { UpdateThreadStateDto } from '../models/UpdateThreadStateDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ThreadsService {
    /**
     * Create a new thread
     * @param requestBody
     * @returns ThreadResponseDto Thread created successfully
     * @throws ApiError
     */
    public static threadsControllerCreateThread(
        requestBody: CreateThreadDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List all threads with lightweight retrieval
     * @param page Page number (1-based)
     * @param limit Number of items per page
     * @returns ThreadListResponseDto Paginated list of threads
     * @throws ApiError
     */
    public static threadsControllerListThreads(
        page?: number,
        limit?: number,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads',
            query: {
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Update thread title
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadResponseDto Thread updated successfully
     * @throws ApiError
     */
    public static threadsControllerUpdateThread(
        id: string,
        requestBody: UpdateThreadDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/threads/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread not found`,
            },
        });
    }
    /**
     * Get a thread by ID with full details
     * @param id Thread UUID
     * @returns ThreadResponseDto Thread found
     * @throws ApiError
     */
    public static threadsControllerGetThread(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Thread not found`,
            },
        });
    }
    /**
     * Delete a thread
     * @param id Thread UUID
     * @returns void
     * @throws ApiError
     */
    public static threadsControllerDeleteThread(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/threads/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Thread not found`,
            },
        });
    }
    /**
     * Get a thread by task ID
     * @param taskId
     * @returns ThreadResponseDto Thread found for task or null when task has no thread
     * @throws ApiError
     */
    public static threadsControllerGetThreadByTaskId(
        taskId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads/by-task/{taskId}',
            path: {
                'taskId': taskId,
            },
        });
    }
    /**
     * Get threads by state context block ID
     * @param stateBlockId
     * @returns ThreadResponseDto Threads found for state block
     * @throws ApiError
     */
    public static threadsControllerGetThreadsByStateBlockId(
        stateBlockId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<ThreadResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads/by-state-block/{stateBlockId}',
            path: {
                'stateBlockId': stateBlockId,
            },
        });
    }
    /**
     * Attach a task to the thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadResponseDto Task attached successfully
     * @throws ApiError
     */
    public static threadsControllerAttachTask(
        id: string,
        requestBody: AttachTaskDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/tasks',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread or task not found`,
            },
        });
    }
    /**
     * Reference a context block in the thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadResponseDto Context block referenced successfully
     * @throws ApiError
     */
    public static threadsControllerReferenceContextBlock(
        id: string,
        requestBody: ReferenceContextBlockDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/context-blocks',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread or context block not found`,
            },
        });
    }
    /**
     * Add a tag to a thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadResponseDto Tag added to thread successfully
     * @throws ApiError
     */
    public static threadsControllerAddTagToThread(
        id: string,
        requestBody: CreateTagDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/tags',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread not found`,
            },
        });
    }
    /**
     * Remove a tag from a thread
     * @param id
     * @param tagId
     * @returns ThreadResponseDto Tag removed from thread successfully
     * @throws ApiError
     */
    public static threadsControllerRemoveTagFromThread(
        id: string,
        tagId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/threads/{id}/tags/{tagId}',
            path: {
                'id': id,
                'tagId': tagId,
            },
            errors: {
                404: `Thread not found`,
            },
        });
    }
    /**
     * Add a participant to the thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadResponseDto Participant added successfully
     * @throws ApiError
     */
    public static threadsControllerAddParticipant(
        id: string,
        requestBody: AddParticipantDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/participants',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread or actor not found`,
            },
        });
    }
    /**
     * Get the state of a thread
     * @param id Thread UUID
     * @returns ThreadStateResponseDto Thread state retrieved successfully
     * @throws ApiError
     */
    public static threadsControllerGetThreadState(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadStateResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads/{id}/state',
            path: {
                'id': id,
            },
            errors: {
                404: `Thread not found`,
            },
        });
    }
    /**
     * Update the state of a thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadStateResponseDto Thread state updated successfully
     * @throws ApiError
     */
    public static threadsControllerUpdateThreadState(
        id: string,
        requestBody: UpdateThreadStateDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadStateResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/threads/{id}/state',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread not found`,
            },
        });
    }
    /**
     * Append content to the state of a thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadStateResponseDto Content appended to thread state successfully
     * @throws ApiError
     */
    public static threadsControllerAppendThreadState(
        id: string,
        requestBody: AppendThreadStateDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadStateResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/state/append',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread not found`,
            },
        });
    }
    /**
     * Create a message in the thread
     * @param id Thread UUID
     * @param requestBody
     * @returns ThreadMessageResponseDto Message created successfully
     * @throws ApiError
     */
    public static threadsControllerCreateMessage(
        id: string,
        requestBody: CreateThreadMessageDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ThreadMessageResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/threads/{id}/messages',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Thread not found`,
            },
        });
    }
    /**
     * List messages in a thread
     * @param id Thread UUID
     * @param page Page number
     * @param limit Number of items per page
     * @returns ListThreadMessagesResponseDto Paginated list of thread messages
     * @throws ApiError
     */
    public static threadsControllerListMessages(
        id: string,
        page: number = 1,
        limit: number = 20,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ListThreadMessagesResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/threads/{id}/messages',
            path: {
                'id': id,
            },
            query: {
                'page': page,
                'limit': limit,
            },
            errors: {
                404: `Thread not found`,
            },
        });
    }
}
