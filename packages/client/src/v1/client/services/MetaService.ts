/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateTagDto } from '../models/CreateTagDto.js';
import type { MetaTagResponseDto } from '../models/MetaTagResponseDto.js';
import type { VersionResponseDto } from '../models/VersionResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class MetaService {
    /**
     * Create a new tag
     * @param requestBody
     * @returns MetaTagResponseDto Tag created successfully
     * @throws ApiError
     */
    public static metaControllerCreateTag(
        requestBody: CreateTagDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<MetaTagResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/meta/tags',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * Get all tags
     * @returns MetaTagResponseDto List of all tags
     * @throws ApiError
     */
    public static metaControllerGetAllTags(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<MetaTagResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/meta/tags',
        });
    }
    /**
     * Get available tag colors
     * @returns string List of available tag colors in hex format
     * @throws ApiError
     */
    public static metaControllerGetTagColors(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<string>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/meta/tags/colors',
        });
    }
    /**
     * Delete a tag from the system
     * @param tagId
     * @returns void
     * @throws ApiError
     */
    public static metaControllerDeleteTag(
        tagId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/meta/tags/{tagId}',
            path: {
                'tagId': tagId,
            },
            errors: {
                404: `Tag not found`,
            },
        });
    }
    /**
     * Get version information
     * @returns VersionResponseDto Version information for backend and UI
     * @throws ApiError
     */
    public static metaControllerGetVersion(config: OpenAPIConfig = OpenAPI): CancelablePromise<VersionResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/meta/version',
        });
    }
}
