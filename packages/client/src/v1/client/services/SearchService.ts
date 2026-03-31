/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GlobalSearchResultDto } from '../models/GlobalSearchResultDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class SearchService {
    /**
     * Global search across all resources
     * @param query Search query string
     * @param limit Maximum number of results to return per category
     * @param threshold Minimum score threshold (0-1, higher is stricter)
     * @returns GlobalSearchResultDto Search results sorted by relevance
     * @throws ApiError
     */
    public static globalSearchControllerSearch(
        query: string,
        limit: number = 10,
        threshold: number = 0.3,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<GlobalSearchResultDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/search/query',
            query: {
                'query': query,
                'limit': limit,
                'threshold': threshold,
            },
        });
    }
}
