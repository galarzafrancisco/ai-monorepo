/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskBlueprintResponseDto } from './TaskBlueprintResponseDto.js';
export type ScheduledTaskResponseDto = {
    /**
     * Unique identifier for the scheduled task
     */
    id: string;
    /**
     * ID of the task blueprint
     */
    taskBlueprintId: string;
    /**
     * The task blueprint details
     */
    taskBlueprint?: TaskBlueprintResponseDto;
    /**
     * Cron expression for scheduling
     */
    cronExpression: string;
    /**
     * Whether the scheduled task is enabled
     */
    enabled: boolean;
    /**
     * Last execution timestamp
     */
    lastRunAt?: Record<string, any> | null;
    /**
     * Next scheduled execution timestamp
     */
    nextRunAt: string;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * Scheduled task creation timestamp
     */
    createdAt: string;
    /**
     * Scheduled task last update timestamp
     */
    updatedAt: string;
};

