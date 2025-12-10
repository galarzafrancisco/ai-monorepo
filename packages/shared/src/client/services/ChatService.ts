/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatSendMessageDto } from '../models/ChatSendMessageDto';
import type { ChatSessionResponseDto } from '../models/ChatSessionResponseDto';
import type { CreateSessionDto } from '../models/CreateSessionDto';
import type { SendMessageResponseDto } from '../models/SendMessageResponseDto';
import type { SessionListResponseDto } from '../models/SessionListResponseDto';
import type { UpdateSessionDto } from '../models/UpdateSessionDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ChatService {
    /**
     * Create a new chat session
     * @param requestBody
     * @returns ChatSessionResponseDto
     * @throws ApiError
     */
    public static chatControllerCreateSession(
        requestBody: CreateSessionDto,
    ): CancelablePromise<ChatSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/chat/sessions',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List chat sessions with optional filtering and pagination
     * @param agentId Filter by agent ID
     * @param project Filter by project label
     * @param isArchived Filter by archived status
     * @param isPinned Filter by pinned status
     * @param page Page number (1-indexed)
     * @param limit Number of items per page
     * @returns SessionListResponseDto
     * @throws ApiError
     */
    public static chatControllerListSessions(
        agentId?: string,
        project?: string,
        isArchived?: boolean,
        isPinned?: boolean,
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<SessionListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/chat/sessions',
            query: {
                'agentId': agentId,
                'project': project,
                'isArchived': isArchived,
                'isPinned': isPinned,
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Get a chat session by ID
     * @param id Session ID
     * @returns ChatSessionResponseDto
     * @throws ApiError
     */
    public static chatControllerGetSession(
        id: string,
    ): CancelablePromise<ChatSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/chat/sessions/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Update a chat session
     * @param id Session ID
     * @param requestBody
     * @returns ChatSessionResponseDto
     * @throws ApiError
     */
    public static chatControllerUpdateSession(
        id: string,
        requestBody: UpdateSessionDto,
    ): CancelablePromise<ChatSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/chat/sessions/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete a chat session
     * @param id Session ID
     * @returns void
     * @throws ApiError
     */
    public static chatControllerDeleteSession(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/chat/sessions/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Send a message to the ADK agent (non-streaming)
     * @param id Session ID
     * @param requestBody
     * @returns SendMessageResponseDto
     * @throws ApiError
     */
    public static chatControllerSendMessage(
        id: string,
        requestBody: ChatSendMessageDto,
    ): CancelablePromise<SendMessageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/chat/sessions/{id}/messages',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Send a message to the ADK agent with streaming response
     * @param id Session ID
     * @param requestBody
     * @returns any
     * @throws ApiError
     */
    public static chatControllerSendMessageStream(
        id: string,
        requestBody: ChatSendMessageDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/chat/sessions/{id}/messages/stream',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
