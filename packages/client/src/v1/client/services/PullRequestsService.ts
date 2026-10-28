/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LookupPullRequestsDto } from '../models/LookupPullRequestsDto.js';
import type { PullRequestResponseDto } from '../models/PullRequestResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class PullRequestsService {
    /**
     * Status of linked pull requests, in the order asked
     * Pull requests Taico has never read are read from GitHub before answering. Stale ones are answered from the stored copy and refreshed in the background; the new state arrives as a pull_request.updated socket event.
     * @param requestBody
     * @returns PullRequestResponseDto
     * @throws ApiError
     */
    public static pullRequestsControllerLookup(
        requestBody: LookupPullRequestsDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<PullRequestResponseDto>> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/pull-requests/lookup',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Stored status of one pull request
     * @param id
     * @returns PullRequestResponseDto
     * @throws ApiError
     */
    public static pullRequestsControllerGet(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<PullRequestResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/pull-requests/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Pull request not found`,
            },
        });
    }
    /**
     * Read the pull request from GitHub now
     * @param id
     * @returns PullRequestResponseDto
     * @throws ApiError
     */
    public static pullRequestsControllerRefresh(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<PullRequestResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/pull-requests/{id}/refresh',
            path: {
                'id': id,
            },
            errors: {
                404: `Pull request not found`,
            },
        });
    }
}
