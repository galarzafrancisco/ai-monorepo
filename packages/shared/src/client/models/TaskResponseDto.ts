/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Comment } from './Comment';
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
    comments: Array<Comment>;
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
        NOT_STARTED = 'not started',
        IN_PROGRESS = 'in progress',
        FOR_REVIEW = 'for review',
        DONE = 'done',
    }
}

