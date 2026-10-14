/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiProviderConnectionResponseDto } from '../models/AiProviderConnectionResponseDto.js';
import type { CompleteAiProviderAuthorizationDto } from '../models/CompleteAiProviderAuthorizationDto.js';
import type { DisconnectAiProviderResponseDto } from '../models/DisconnectAiProviderResponseDto.js';
import type { StartAiProviderAuthorizationResponseDto } from '../models/StartAiProviderAuthorizationResponseDto.js';
import type { UpdateAiProviderConnectionDto } from '../models/UpdateAiProviderConnectionDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AiProviderConnectionsService {
    /**
     * Get your own connection to the provider
     * @param id AI provider identifier
     * @returns AiProviderConnectionResponseDto
     * @throws ApiError
     */
    public static aiProviderConnectionsControllerGetConnection(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderConnectionResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/ai-providers/{id}/connection',
            path: {
                'id': id,
            },
            errors: {
                404: `AI provider not found`,
            },
        });
    }
    /**
     * Change what your connection may be used for
     * @param id AI provider identifier
     * @param requestBody
     * @returns AiProviderConnectionResponseDto
     * @throws ApiError
     */
    public static aiProviderConnectionsControllerUpdateConnection(
        id: string,
        requestBody: UpdateAiProviderConnectionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderConnectionResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/ai-providers/{id}/connection',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Disconnect your account and revoke its grant at the provider
     * @param id AI provider identifier
     * @returns DisconnectAiProviderResponseDto
     * @throws ApiError
     */
    public static aiProviderConnectionsControllerDisconnect(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<DisconnectAiProviderResponseDto> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/ai-providers/{id}/connection',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Start signing in to the provider with your own account
     * @param id AI provider identifier
     * @returns StartAiProviderAuthorizationResponseDto
     * @throws ApiError
     */
    public static aiProviderConnectionsControllerStartAuthorization(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<StartAiProviderAuthorizationResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/ai-providers/{id}/connection/authorize',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Finish the sign-in you started with what the provider sent back
     * @param id AI provider identifier
     * @param requestBody
     * @returns AiProviderConnectionResponseDto
     * @throws ApiError
     */
    public static aiProviderConnectionsControllerCompleteAuthorization(
        id: string,
        requestBody: CompleteAiProviderAuthorizationDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderConnectionResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/ai-providers/{id}/connection/callback',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
