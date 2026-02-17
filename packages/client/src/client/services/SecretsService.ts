/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateSecretDto } from '../models/CreateSecretDto.js';
import type { SecretResponseDto } from '../models/SecretResponseDto.js';
import type { SecretValueResponseDto } from '../models/SecretValueResponseDto.js';
import type { UpdateSecretDto } from '../models/UpdateSecretDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class SecretsService {
    /**
     * Create a new secret
     * @param requestBody
     * @returns SecretResponseDto Secret created successfully
     * @throws ApiError
     */
    public static secretsControllerCreateSecret(
        requestBody: CreateSecretDto,
    ): CancelablePromise<SecretResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/secrets',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List all secrets - values not included
     * @returns SecretResponseDto List of secrets (no values)
     * @throws ApiError
     */
    public static secretsControllerListSecrets(): CancelablePromise<Array<SecretResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/secrets',
        });
    }
    /**
     * Get secret metadata by ID - value not included
     * @param id Secret identifier
     * @returns SecretResponseDto Secret metadata
     * @throws ApiError
     */
    public static secretsControllerGetSecret(
        id: string,
    ): CancelablePromise<SecretResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/secrets/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Secret not found`,
            },
        });
    }
    /**
     * Update a secret
     * @param id Secret identifier
     * @param requestBody
     * @returns SecretResponseDto Secret updated successfully
     * @throws ApiError
     */
    public static secretsControllerUpdateSecret(
        id: string,
        requestBody: UpdateSecretDto,
    ): CancelablePromise<SecretResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/secrets/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Secret not found`,
            },
        });
    }
    /**
     * Delete a secret
     * @param id Secret identifier
     * @returns void
     * @throws ApiError
     */
    public static secretsControllerDeleteSecret(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/secrets/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Secret not found`,
            },
        });
    }
    /**
     * Get decrypted secret value
     * @param id Secret identifier
     * @returns SecretValueResponseDto Decrypted secret value
     * @throws ApiError
     */
    public static secretsControllerGetSecretValue(
        id: string,
    ): CancelablePromise<SecretValueResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/secrets/{id}/value',
            path: {
                'id': id,
            },
            errors: {
                404: `Secret not found`,
            },
        });
    }
}
