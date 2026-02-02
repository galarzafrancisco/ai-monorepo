/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateTagDto } from '../models/CreateTagDto.js';
import type { MetaTagResponseDto } from '../models/MetaTagResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
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
    ): CancelablePromise<MetaTagResponseDto> {
        return __request(OpenAPI, {
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
    public static metaControllerGetAllTags(): CancelablePromise<Array<MetaTagResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/meta/tags',
        });
    }
    /**
     * Get available tag colors
     * @returns string List of available tag colors in hex format
     * @throws ApiError
     */
    public static metaControllerGetTagColors(): CancelablePromise<Array<string>> {
        return __request(OpenAPI, {
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
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
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
}
