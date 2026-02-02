/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ThreadListItemResponseDto } from './ThreadListItemResponseDto.js';
export type ThreadListResponseDto = {
    /**
     * Array of thread list items
     */
    items: Array<ThreadListItemResponseDto>;
    /**
     * Total number of threads
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

