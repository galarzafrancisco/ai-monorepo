/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateExecutionStatsDto = {
    /**
     * Harness used by the worker to run this execution
     */
    harness?: string | null;
    /**
     * Model provider id used by the harness
     */
    providerId?: string | null;
    /**
     * Model id used by the harness
     */
    modelId?: string | null;
    /**
     * Input token usage when available
     */
    inputTokens?: number | null;
    /**
     * Output token usage when available
     */
    outputTokens?: number | null;
    /**
     * Total token usage when available
     */
    totalTokens?: number | null;
};

