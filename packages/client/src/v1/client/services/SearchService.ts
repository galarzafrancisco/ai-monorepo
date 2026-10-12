/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GlobalSearchResultDto } from '../models/GlobalSearchResultDto.js';
import type { SearchIndexStatusDto } from '../models/SearchIndexStatusDto.js';
import type { SearchResultType } from '../models/SearchResultType.js';
import type { SearchSettingsDto } from '../models/SearchSettingsDto.js';
import type { UpdateSearchSettingsDto } from '../models/UpdateSearchSettingsDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class SearchService {
    /**
     * Global search across all resources
     * Searches tasks (including their comments), context blocks, tools, agents and projects by keyword, fuzzy title and meaning, and returns one list ranked by relevance.
     * @param query What to look for. Keywords, a partial title or a question in plain language all work.
     * @param limit Maximum number of results. Defaults to the configured default limit.
     * @param types Only return these kinds of result. All kinds when omitted.
     * @returns GlobalSearchResultDto Search results sorted by relevance
     * @throws ApiError
     */
    public static globalSearchControllerSearch(
        query: string,
        limit?: number,
        types?: Array<SearchResultType>,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<GlobalSearchResultDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/search/query',
            query: {
                'query': query,
                'limit': limit,
                'types': types,
            },
        });
    }
    /**
     * Get the search settings
     * @returns SearchSettingsDto Every setting with its current value
     * @throws ApiError
     */
    public static searchAdminControllerGetSearchSettings(config: OpenAPIConfig = OpenAPI): CancelablePromise<SearchSettingsDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/search/settings',
        });
    }
    /**
     * Change search settings
     * Changes the settings sent and leaves the others as they are.
     * @param requestBody
     * @returns SearchSettingsDto The settings after the change
     * @throws ApiError
     */
    public static searchAdminControllerUpdateSearchSettings(
        requestBody: UpdateSearchSettingsDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<SearchSettingsDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/search/settings',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Reset the search settings to their defaults
     * @returns SearchSettingsDto The default settings
     * @throws ApiError
     */
    public static searchAdminControllerResetSearchSettings(config: OpenAPIConfig = OpenAPI): CancelablePromise<SearchSettingsDto> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/search/settings',
        });
    }
    /**
     * Get the state of the search index
     * @returns SearchIndexStatusDto What is indexed and embedded
     * @throws ApiError
     */
    public static searchAdminControllerGetSearchIndexStatus(config: OpenAPIConfig = OpenAPI): CancelablePromise<SearchIndexStatusDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/search/index',
        });
    }
    /**
     * Rebuild the search index
     * Discards the index and builds it again. Keyword search is complete when this returns; embeddings are rebuilt in the background.
     * @returns SearchIndexStatusDto The index right after the rebuild started
     * @throws ApiError
     */
    public static searchAdminControllerRebuildSearchIndex(config: OpenAPIConfig = OpenAPI): CancelablePromise<SearchIndexStatusDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/search/index/rebuild',
        });
    }
}
