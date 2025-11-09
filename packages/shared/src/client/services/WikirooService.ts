/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePageDto } from '../models/CreatePageDto';
import type { PageListResponseDto } from '../models/PageListResponseDto';
import type { PageResponseDto } from '../models/PageResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WikirooService {
    /**
     * Create a new wiki page
     * @param requestBody
     * @returns PageResponseDto Wiki page created successfully
     * @throws ApiError
     */
    public static wikirooControllerCreatePage(
        requestBody: CreatePageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/wikiroo/pages',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List wiki pages without content
     * @returns PageListResponseDto List of wiki pages
     * @throws ApiError
     */
    public static wikirooControllerListPages(): CancelablePromise<PageListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/wikiroo/pages',
        });
    }
    /**
     * Fetch a wiki page by ID
     * @param id Wiki page identifier
     * @returns PageResponseDto Wiki page retrieved successfully
     * @throws ApiError
     */
    public static wikirooControllerGetPage(
        id: string,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/wikiroo/pages/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpPut(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpDelete(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpPatch(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpOptions(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'OPTIONS',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static wikirooControllerHandleMcpHead(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'HEAD',
            url: '/api/v1/wikiroo/pages/mcp',
        });
    }
}
