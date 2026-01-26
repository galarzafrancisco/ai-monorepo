/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FeedListResponseDto } from '../models/FeedListResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FeedService {
    /**
     * Get activity feed
     * Retrieve a timeline of events that have occurred in the system, optionally filtered by task
     * @param taskId Filter feed items by task ID
     * @param page Page number (1-indexed)
     * @param limit Items per page (1-100)
     * @returns FeedListResponseDto Paginated list of feed items sorted by recency
     * @throws ApiError
     */
    public static feedControllerListFeed(
        taskId?: string,
        page: number = 1,
        limit: number = 50,
    ): CancelablePromise<FeedListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/feed',
            query: {
                'taskId': taskId,
                'page': page,
                'limit': limit,
            },
        });
    }
}
