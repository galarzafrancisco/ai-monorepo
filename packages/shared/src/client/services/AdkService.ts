/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateAdkSessionDto } from '../models/CreateAdkSessionDto';
import type { SendMessageDto } from '../models/SendMessageDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdkService {
    /**
     * List all available ADK apps
     * @returns string
     * @throws ApiError
     */
    public static adkControllerListApps(): CancelablePromise<Array<string>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/adk/apps',
        });
    }
    /**
     * Create a new ADK session
     * @param requestBody
     * @returns any
     * @throws ApiError
     */
    public static adkControllerCreateSession(
        requestBody: CreateAdkSessionDto,
    ): CancelablePromise<any> {
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
     * @returns any
     * @throws ApiError
     */
    public static adkControllerListSessions(
        appId: string,
        userId: string,
    ): CancelablePromise<any> {
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
     * @returns any
     * @throws ApiError
     */
    public static adkControllerGetSession(
        appId: string,
        userId: string,
        sessionId: string,
    ): CancelablePromise<any> {
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
     * @returns any
     * @throws ApiError
     */
    public static adkControllerSendMessage(
        requestBody: SendMessageDto,
    ): CancelablePromise<any> {
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
