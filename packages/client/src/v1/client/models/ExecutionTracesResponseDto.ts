/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExecutionTraceResponseDto } from './ExecutionTraceResponseDto.js';
export type ExecutionTracesResponseDto = {
    items: Array<ExecutionTraceResponseDto>;
    /**
     * Worker lifecycle records across the entire execution, independent of the raw-event page
     */
    lifecycle: Array<ExecutionTraceResponseDto>;
    hasMoreBefore: boolean;
    nextAfterSequence: number;
};

