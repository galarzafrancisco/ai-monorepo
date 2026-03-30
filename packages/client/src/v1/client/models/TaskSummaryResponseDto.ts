/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
import type { InputRequestResponseDto } from './InputRequestResponseDto.js';
import type { TagResponseDto } from './TagResponseDto.js';
export type TaskSummaryResponseDto = {
    /**
     * Task ID
     */
    id: string;
    /**
     * Task name
     */
    name: string;
    /**
     * Task description
     */
    description: string;
    /**
     * Task status
     */
    status: TaskSummaryResponseDto.status;
    /**
     * Assignee actor details
     */
    assigneeActor?: ActorResponseDto | null;
    /**
     * Creator actor details
     */
    createdByActor: ActorResponseDto;
    /**
     * Tags associated with the task
     */
    tags: Array<TagResponseDto>;
    /**
     * Number of comments on the task
     */
    commentCount: number;
    /**
     * Input requests associated with the task
     */
    inputRequests: Array<InputRequestResponseDto>;
    /**
     * Task last update timestamp
     */
    updatedAt: string;
};
export namespace TaskSummaryResponseDto {
    /**
     * Task status
     */
    export enum status {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

