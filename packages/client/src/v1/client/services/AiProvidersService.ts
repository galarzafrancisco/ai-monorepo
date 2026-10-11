/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiProviderModelResponseDto } from '../models/AiProviderModelResponseDto.js';
import type { AiProviderResponseDto } from '../models/AiProviderResponseDto.js';
import type { CreateAiProviderDto } from '../models/CreateAiProviderDto.js';
import type { UpdateAiProviderDto } from '../models/UpdateAiProviderDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AiProvidersService {
    /**
     * Create an AI provider
     * @param requestBody
     * @returns AiProviderResponseDto AI provider created successfully
     * @throws ApiError
     */
    public static aiProvidersControllerCreateAiProvider(
        requestBody: CreateAiProviderDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/ai-providers',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List all AI providers
     * @returns AiProviderResponseDto List of AI providers
     * @throws ApiError
     */
    public static aiProvidersControllerListAiProviders(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<AiProviderResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/ai-providers',
        });
    }
    /**
     * Get AI provider by ID
     * @param id AI provider identifier
     * @returns AiProviderResponseDto AI provider details
     * @throws ApiError
     */
    public static aiProvidersControllerGetAiProvider(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/ai-providers/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `AI provider not found`,
            },
        });
    }
    /**
     * Update an AI provider
     * @param id AI provider identifier
     * @param requestBody
     * @returns AiProviderResponseDto AI provider updated successfully
     * @throws ApiError
     */
    public static aiProvidersControllerUpdateAiProvider(
        id: string,
        requestBody: UpdateAiProviderDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiProviderResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/ai-providers/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `AI provider not found`,
            },
        });
    }
    /**
     * Delete an AI provider
     * @param id AI provider identifier
     * @returns void
     * @throws ApiError
     */
    public static aiProvidersControllerDeleteAiProvider(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/ai-providers/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `AI provider not found`,
            },
        });
    }
    /**
     * List the models the provider offers, fetched live from the provider
     * @param id AI provider identifier
     * @returns AiProviderModelResponseDto Models offered by the provider
     * @throws ApiError
     */
    public static aiProvidersControllerListAiProviderModels(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<AiProviderModelResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/ai-providers/{id}/models',
            path: {
                'id': id,
            },
            errors: {
                404: `AI provider not found`,
            },
        });
    }
}
