/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskExecutionHistoryResponseDto } from './TaskExecutionHistoryResponseDto.js';
export type TaskExecutionHistoryListResponseDto = {
    /**
     * List of task execution history entries
     */
    items: Array<TaskExecutionHistoryResponseDto>;
    /**
     * Total number of history entries
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

