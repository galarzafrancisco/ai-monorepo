/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TaskExecutionQueueEntryResponseDto = {
    /**
     * Task ID present in the execution queue
     */
    taskId: string;
    /**
     * Task name at the time of retrieval
     */
    taskName: Record<string, any> | null;
    /**
     * Current task status
     */
    taskStatus: TaskExecutionQueueEntryResponseDto.taskStatus | null;
};
export namespace TaskExecutionQueueEntryResponseDto {
    /**
     * Current task status
     */
    export enum taskStatus {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

