/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ExecutionStatsResponseDto = {
    /**
     * Harness used to execute the run
     */
    harness: string | null;
    /**
     * LLM provider id resolved for this run
     */
    providerId: string | null;
    /**
     * LLM model id resolved for this run
     */
    modelId: string | null;
    /**
     * Input token usage when available
     */
    inputTokens: number | null;
    /**
     * Output token usage when available
     */
    outputTokens: number | null;
    /**
     * Total token usage when available
     */
    totalTokens: number | null;
};

