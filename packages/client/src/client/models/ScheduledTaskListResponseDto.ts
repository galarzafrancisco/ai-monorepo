/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScheduledTaskResponseDto } from './ScheduledTaskResponseDto.js';
export type ScheduledTaskListResponseDto = {
    /**
     * List of scheduled tasks
     */
    items: Array<ScheduledTaskResponseDto>;
    /**
     * Total number of scheduled tasks
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
};

