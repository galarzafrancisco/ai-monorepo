/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdkListSessionsResponseDto } from '../models/AdkListSessionsResponseDto';
import type { AdkSendMessageResponseDto } from '../models/AdkSendMessageResponseDto';
import type { AdkSessionResponseDto } from '../models/AdkSessionResponseDto';
import type { CreateAdkSessionDto } from '../models/CreateAdkSessionDto';
import type { ListAppsResponseDto } from '../models/ListAppsResponseDto';
import type { SendMessageDto } from '../models/SendMessageDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdkService {
    /**
     * List all available ADK apps
     * @returns ListAppsResponseDto
     * @throws ApiError
     */
    public static adkControllerListApps(): CancelablePromise<ListAppsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/adk/apps',
        });
    }
    /**
     * Create a new ADK session
     * @param requestBody
     * @returns AdkSessionResponseDto
     * @throws ApiError
     */
    public static adkControllerCreateSession(
        requestBody: CreateAdkSessionDto,
    ): CancelablePromise<AdkSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/adk/sessions',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List sessions for an app and user
     * @param appId
     * @param userId
     * @returns AdkListSessionsResponseDto
     * @throws ApiError
     */
    public static adkControllerListSessions(
        appId: string,
        userId: string,
    ): CancelablePromise<AdkListSessionsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/adk/apps/{appId}/users/{userId}/sessions',
            path: {
                'appId': appId,
                'userId': userId,
            },
        });
    }
    /**
     * Get a specific session
     * @param appId App ID
     * @param userId User ID
     * @param sessionId Session ID
     * @returns AdkSessionResponseDto
     * @throws ApiError
     */
    public static adkControllerGetSession(
        appId: string,
        userId: string,
        sessionId: string,
    ): CancelablePromise<AdkSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/adk/apps/{appId}/users/{userId}/sessions/{sessionId}',
            path: {
                'appId': appId,
                'userId': userId,
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Send a message to an ADK agent (non-streaming)
     * @param requestBody
     * @returns AdkSendMessageResponseDto
     * @throws ApiError
     */
    public static adkControllerSendMessage(
        requestBody: SendMessageDto,
    ): CancelablePromise<AdkSendMessageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/adk/messages',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Send a message to an ADK agent with SSE streaming
     * @param requestBody
     * @returns any
     * @throws ApiError
     */
    public static adkControllerSendMessageStream(
        requestBody: SendMessageDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/adk/messages/stream',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
