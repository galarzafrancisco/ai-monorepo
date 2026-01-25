/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FeedItemResponseDto } from './FeedItemResponseDto';
export type FeedListResponseDto = {
    /**
     * List of feed items
     */
    items: Array<FeedItemResponseDto>;
    /**
     * Total number of feed items
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Items per page
     */
    limit: number;
    /**
     * Total number of pages
     */
    totalPages: number;
};

