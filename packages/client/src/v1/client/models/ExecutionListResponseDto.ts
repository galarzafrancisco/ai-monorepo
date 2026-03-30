/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExecutionResponseDto } from './ExecutionResponseDto.js';
export type ExecutionListResponseDto = {
    /**
     * Array of task executions
     */
    items: Array<ExecutionResponseDto>;
    /**
     * Total number of executions matching the filter
     */
    total: number;
    /**
     * Current page number (1-indexed)
     */
    page: number;
    /**
     * Number of items per page
     */
    limit: number;
    /**
     * Total number of pages
     */
    totalPages: number;
};

