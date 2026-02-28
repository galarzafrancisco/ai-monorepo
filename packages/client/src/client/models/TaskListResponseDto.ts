/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskResponseDto } from './TaskResponseDto.js';

export type TaskBoardColumnResponseDto = {
    /**
     * List of tasks for this status column
     */
    items: Array<TaskResponseDto>;
    /**
     * Total number of tasks in this status column
     */
    total: number;
    /**
     * Whether more tasks are available after this slice
     */
    hasMore: boolean;
    /**
     * Cursor for loading the next slice of this status column
     */
    nextCursor: string | null;
};

export type TaskListResponseDto = {
    /**
     * Total number of tasks matching the filters
     */
    total: number;
    /**
     * Number of tasks returned per status column
     */
    columnLimit: number;
    columns: {
        NOT_STARTED: TaskBoardColumnResponseDto;
        IN_PROGRESS: TaskBoardColumnResponseDto;
        FOR_REVIEW: TaskBoardColumnResponseDto;
        DONE: TaskBoardColumnResponseDto;
    };
};
