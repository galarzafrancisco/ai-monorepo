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
    taskName?: Record<string, any> | null;
    /**
     * Agent actor ID
     */
    agentActorId: string;
    /**
     * Agent slug
     */
    agentSlug?: Record<string, any> | null;
    /**
     * Agent name
     */
    agentName?: Record<string, any> | null;
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
    claimedAt?: Record<string, any> | null;
    /**
     * When the execution started running
     */
    startedAt?: Record<string, any> | null;
    /**
     * When the execution finished
     */
    finishedAt?: Record<string, any> | null;
    /**
     * Worker session ID that claimed this execution
     */
    workerSessionId?: Record<string, any> | null;
    /**
     * When the worker lease expires
     */
    leaseExpiresAt?: Record<string, any> | null;
    /**
     * When a stop was requested
     */
    stopRequestedAt?: Record<string, any> | null;
    /**
     * Failure reason if execution failed
     */
    failureReason?: Record<string, any> | null;
    /**
     * Why this execution was triggered
     */
    triggerReason?: Record<string, any> | null;
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

