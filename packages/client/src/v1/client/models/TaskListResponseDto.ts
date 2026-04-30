/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskResponseDto } from './TaskResponseDto.js';
export type TaskListResponseDto = {
    /**
     * List of tasks
     */
    items: Array<TaskResponseDto>;
    /**
     * Total number of tasks matching the filters
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per status per page when no status filter is provided
     */
    limit: number;
    /**
     * Total number of pages based on the largest matching status bucket
     */
    totalPages: number;
};

