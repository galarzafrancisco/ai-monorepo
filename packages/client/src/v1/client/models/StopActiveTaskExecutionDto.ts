/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type StopActiveTaskExecutionDto = {
    /**
     * Terminal execution status
     */
    status: StopActiveTaskExecutionDto.status;
    /**
     * Optional error code for failed execution outcomes
     */
    errorCode?: StopActiveTaskExecutionDto.errorCode | null;
    /**
     * Optional human-readable error message for failed or cancelled executions
     */
    errorMessage?: string | null;
};
export namespace StopActiveTaskExecutionDto {
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
     * Optional error code for failed execution outcomes
     */
    export enum errorCode {
        OUT_OF_QUOTA = 'OUT_OF_QUOTA',
        INTERRUPTED = 'INTERRUPTED',
        UNKNOWN = 'UNKNOWN',
    }
}

