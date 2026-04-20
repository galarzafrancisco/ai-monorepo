/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActiveTaskExecutionResponseDto } from './ActiveTaskExecutionResponseDto.js';
export type ActiveTaskExecutionListResponseDto = {
    /**
     * List of active task executions
     */
    items: Array<ActiveTaskExecutionResponseDto>;
    /**
     * Total number of active executions
     */
    total: number;
    /**
     * Current page number
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

