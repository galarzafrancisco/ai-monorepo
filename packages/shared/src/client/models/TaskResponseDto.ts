/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CommentResponseDto } from './CommentResponseDto';
import type { TagResponseDto } from './TagResponseDto';
export type TaskResponseDto = {
    /**
     * Unique identifier for the task
     */
    id: string;
    /**
     * Name of the task
     */
    name: string;
    /**
     * Detailed description of the task
     */
    description: string;
    /**
     * Current status of the task
     */
    status: TaskResponseDto.status;
    /**
     * Name of the assignee (for AI agents)
     */
    assignee?: string | null;
    /**
     * Session ID for tracking AI agent work
     */
    sessionId?: string | null;
    /**
     * Comments associated with the task
     */
    comments: Array<CommentResponseDto>;
    /**
     * Tags associated with the task
     */
    tags: Array<TagResponseDto>;
    /**
     * Name of the person who created the task
     */
    createdBy: string;
    /**
     * Array of task IDs that this task depends on
     */
    dependsOnIds: Array<string>;
    /**
     * Task creation timestamp
     */
    createdAt: string;
    /**
     * Task last update timestamp
     */
    updatedAt: string;
};
export namespace TaskResponseDto {
    /**
     * Current status of the task
     */
    export enum status {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

