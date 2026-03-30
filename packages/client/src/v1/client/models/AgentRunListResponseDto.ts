/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentRunResponseDto } from './AgentRunResponseDto.js';
export type AgentRunListResponseDto = {
    /**
     * List of agent runs
     */
    items: Array<AgentRunResponseDto>;
    /**
     * Total count of agent runs
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Items per page
     */
    limit: number;
};

