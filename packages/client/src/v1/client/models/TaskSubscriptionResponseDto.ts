/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TaskSubscriptionResponseDto = {
    /**
     * ID of the task the thread is subscribed to
     */
    taskId: string;
    /**
     * Task name
     */
    name: string;
    /**
     * Current task status
     */
    status: TaskSubscriptionResponseDto.status;
    /**
     * When the thread subscribed to the task
     */
    createdAt: string;
};
export namespace TaskSubscriptionResponseDto {
    /**
     * Current task status
     */
    export enum status {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

