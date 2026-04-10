/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActiveTaskExecutionTagSnapshotResponseDto } from './ActiveTaskExecutionTagSnapshotResponseDto.js';
export type ActiveTaskExecutionResponseDto = {
    /**
     * Execution ID
     */
    id: string;
    /**
     * Task ID for the active execution
     */
    taskId: string;
    /**
     * Task name at the time of retrieval
     */
    taskName: string | null;
    /**
     * Current task status
     */
    taskStatus: ActiveTaskExecutionResponseDto.taskStatus | null;
    /**
     * When the task was claimed into the active table
     */
    claimedAt: string;
    /**
     * Latest worker heartbeat received for this active execution
     */
    lastHeartbeatAt: string | null;
    /**
     * Agent runtime session identifier associated with this execution
     */
    runnerSessionId: string | null;
    /**
     * Number of tool calls made during this execution so far
     */
    toolCallCount: number;
    /**
     * Task status before the task was claimed
     */
    taskStatusBeforeClaim: ActiveTaskExecutionResponseDto.taskStatusBeforeClaim;
    /**
     * Task tags before the task was claimed
     */
    taskTagsBeforeClaim: Array<ActiveTaskExecutionTagSnapshotResponseDto>;
    /**
     * OAuth client id of the worker that claimed the task
     */
    workerClientId: string;
    /**
     * Task assignee actor id before the task was claimed
     */
    taskAssigneeActorIdBeforeClaim: string | null;
    /**
     * Agent actor id that picked up the task
     */
    agentActorId: string;
};
export namespace ActiveTaskExecutionResponseDto {
    /**
     * Current task status
     */
    export enum taskStatus {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
    /**
     * Task status before the task was claimed
     */
    export enum taskStatusBeforeClaim {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

