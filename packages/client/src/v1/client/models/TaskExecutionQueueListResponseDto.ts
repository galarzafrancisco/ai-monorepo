/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskExecutionQueueEntryResponseDto } from './TaskExecutionQueueEntryResponseDto.js';
export type TaskExecutionQueueListResponseDto = {
    /**
     * List of task execution queue entries
     */
    items: Array<TaskExecutionQueueEntryResponseDto>;
    /**
     * Total number of queue entries
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

