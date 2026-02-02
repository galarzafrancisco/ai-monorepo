/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
import type { CommentResponseDto } from './CommentResponseDto.js';
import type { InputRequestResponseDto } from './InputRequestResponseDto.js';
import type { TagResponseDto } from './TagResponseDto.js';
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
     * Slug of the assignee (for backward compatibility)
     */
    assignee?: Record<string, any> | null;
    /**
     * Actor assigned to this task
     */
    assigneeActor?: ActorResponseDto | null;
    /**
     * Session ID for tracking AI agent work
     */
    sessionId?: string | null;
    /**
     * Comments associated with the task
     */
    comments: Array<CommentResponseDto>;
    /**
     * Input requests associated with the task
     */
    inputRequests: Array<InputRequestResponseDto>;
    /**
     * Tags associated with the task
     */
    tags: Array<TagResponseDto>;
    /**
     * Actor who created this task
     */
    createdByActor: ActorResponseDto;
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

