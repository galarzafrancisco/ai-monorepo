/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueResponseDto } from '../models/IssueResponseDto.js';
import type { LookupIssuesDto } from '../models/LookupIssuesDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class IssuesService {
    /**
     * Status of linked issues, in the order asked
     * Issues Taico has never read are read from GitHub before answering. Stale ones are answered from the stored copy and refreshed in the background; the new state arrives as an issue.updated socket event. Issues on a host that is neither github.com nor a GitHub Enterprise Taico has a connection to are left out.
     * @param requestBody
     * @returns IssueResponseDto
     * @throws ApiError
     */
    public static issuesControllerLookup(
        requestBody: LookupIssuesDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<IssueResponseDto>> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/issues/lookup',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Stored status of one issue
     * @param id
     * @returns IssueResponseDto
     * @throws ApiError
     */
    public static issuesControllerGet(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<IssueResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/issues/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Issue not found`,
            },
        });
    }
    /**
     * Read the issue from GitHub now
     * @param id
     * @returns IssueResponseDto
     * @throws ApiError
     */
    public static issuesControllerRefresh(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<IssueResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/issues/{id}/refresh',
            path: {
                'id': id,
            },
            errors: {
                404: `Issue not found`,
            },
        });
    }
}
