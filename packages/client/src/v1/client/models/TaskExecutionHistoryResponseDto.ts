/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExecutionStatsResponseDto } from './ExecutionStatsResponseDto.js';
export type TaskExecutionHistoryResponseDto = {
    /**
     * History row ID
     */
    id: string;
    /**
     * Task ID for the historical execution
     */
    taskId: string;
    /**
     * Task name at the time of retrieval
     */
    taskName: string | null;
    /**
     * Current task status
     */
    taskStatus: TaskExecutionHistoryResponseDto.taskStatus | null;
    /**
     * When the task was originally claimed
     */
    claimedAt: string;
    /**
     * When the active execution transitioned into history
     */
    transitionedAt: string;
    /**
     * Actor id of the agent that worked on the task
     */
    agentActorId: string;
    /**
     * OAuth client id of the worker that executed the task
     */
    workerClientId: string;
    /**
     * Agent runtime session identifier associated with this execution
     */
    runnerSessionId: string | null;
    /**
     * Number of tool calls made during the execution
     */
    toolCallCount: number;
    /**
     * Terminal execution status
     */
    status: TaskExecutionHistoryResponseDto.status;
    /**
     * Optional failure code when execution ended with an error
     */
    errorCode: TaskExecutionHistoryResponseDto.errorCode | null;
    /**
     * Optional human-readable error message for failed or cancelled executions
     */
    errorMessage: string | null;
    /**
     * Execution metadata and usage stats
     */
    stats: ExecutionStatsResponseDto | null;
};
export namespace TaskExecutionHistoryResponseDto {
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
     * Terminal execution status
     */
    export enum status {
        SUCCEEDED = 'SUCCEEDED',
        FAILED = 'FAILED',
        STALE = 'STALE',
        CANCELLED = 'CANCELLED',
    }
    /**
     * Optional failure code when execution ended with an error
     */
    export enum errorCode {
        OUT_OF_QUOTA = 'OUT_OF_QUOTA',
        INTERRUPTED = 'INTERRUPTED',
        UNKNOWN = 'UNKNOWN',
    }
}

