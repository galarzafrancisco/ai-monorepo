/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ExecutionTraceResponseDto = {
    executionId: string;
    sequence: number;
    source: ExecutionTraceResponseDto.source;
    harness: string | null;
    runnerSessionId: string | null;
    emittedAt: string;
    receivedAt: string;
    /**
     * Unmodified harness JSON event
     */
    payload: Record<string, any> | null;
};
export namespace ExecutionTraceResponseDto {
    export enum source {
        WORKER = 'worker',
        HARNESS = 'harness',
    }
}

