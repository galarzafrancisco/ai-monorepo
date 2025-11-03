/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskResponseDto } from './TaskResponseDto';
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
     * Number of items per page
     */
    limit: number;
    /**
     * Total number of pages
     */
    totalPages: number;
};

