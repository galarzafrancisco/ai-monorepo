/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto';
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

