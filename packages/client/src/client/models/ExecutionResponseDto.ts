/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ExecutionResponseDto = {
    /**
     * Unique execution identifier
     */
    id: string;
    /**
     * Task ID
     */
    taskId: string;
    /**
     * Task name
     */
    taskName?: string | null;
    /**
     * Agent actor ID
     */
    agentActorId: string;
    /**
     * Agent slug
     */
    agentSlug?: string | null;
    /**
     * Agent name
     */
    agentName?: string | null;
    /**
     * Execution status
     */
    status: ExecutionResponseDto.status;
    /**
     * When the execution was requested
     */
    requestedAt: string;
    /**
     * When the execution was claimed by a worker
     */
    claimedAt?: string | null;
    /**
     * When the execution started running
     */
    startedAt?: string | null;
    /**
     * When the execution finished
     */
    finishedAt?: string | null;
    /**
     * Worker session ID that claimed this execution
     */
    workerSessionId?: string | null;
    /**
     * When the worker lease expires
     */
    leaseExpiresAt?: string | null;
    /**
     * When a stop was requested
     */
    stopRequestedAt?: string | null;
    /**
     * Failure reason if execution failed
     */
    failureReason?: string | null;
    /**
     * Why this execution was triggered
     */
    triggerReason?: string | null;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * Execution creation timestamp
     */
    createdAt: string;
    /**
     * Execution last update timestamp
     */
    updatedAt: string;
};
export namespace ExecutionResponseDto {
    /**
     * Execution status
     */
    export enum status {
        READY = 'READY',
        CLAIMED = 'CLAIMED',
        RUNNING = 'RUNNING',
        STOP_REQUESTED = 'STOP_REQUESTED',
        COMPLETED = 'COMPLETED',
        FAILED = 'FAILED',
        CANCELLED = 'CANCELLED',
        STALE = 'STALE',
    }
}

