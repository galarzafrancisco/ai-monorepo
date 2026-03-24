/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatProviderResponseDto } from '../models/ChatProviderResponseDto.js';
import type { CreateChatProviderDto } from '../models/CreateChatProviderDto.js';
import type { SetActiveChatProviderDto } from '../models/SetActiveChatProviderDto.js';
import type { UpdateChatProviderDto } from '../models/UpdateChatProviderDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ChatProvidersService {
    /**
     * Create a new chat provider
     * @param requestBody
     * @returns ChatProviderResponseDto Chat provider created successfully
     * @throws ApiError
     */
    public static chatProvidersControllerCreateChatProvider(
        requestBody: CreateChatProviderDto,
    ): CancelablePromise<ChatProviderResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/chat-providers',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List all chat providers
     * @returns ChatProviderResponseDto List of chat providers
     * @throws ApiError
     */
    public static chatProvidersControllerListChatProviders(): CancelablePromise<Array<ChatProviderResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/chat-providers',
        });
    }
    /**
     * Get chat provider by ID
     * @param id Chat provider identifier
     * @returns ChatProviderResponseDto Chat provider details
     * @throws ApiError
     */
    public static chatProvidersControllerGetChatProvider(
        id: string,
    ): CancelablePromise<ChatProviderResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/chat-providers/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Chat provider not found`,
            },
        });
    }
    /**
     * Update a chat provider
     * @param id Chat provider identifier
     * @param requestBody
     * @returns ChatProviderResponseDto Chat provider updated successfully
     * @throws ApiError
     */
    public static chatProvidersControllerUpdateChatProvider(
        id: string,
        requestBody: UpdateChatProviderDto,
    ): CancelablePromise<ChatProviderResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/chat-providers/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Chat provider not found`,
            },
        });
    }
    /**
     * Delete a chat provider
     * @param id Chat provider identifier
     * @returns void
     * @throws ApiError
     */
    public static chatProvidersControllerDeleteChatProvider(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/chat-providers/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Chat provider not found`,
            },
        });
    }
    /**
     * Set the active chat provider
     * @param requestBody
     * @returns ChatProviderResponseDto Active chat provider set successfully
     * @throws ApiError
     */
    public static chatProvidersControllerSetActiveChatProvider(
        requestBody: SetActiveChatProviderDto,
    ): CancelablePromise<ChatProviderResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/chat-providers/set-active',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Chat provider not found`,
            },
        });
    }
}
