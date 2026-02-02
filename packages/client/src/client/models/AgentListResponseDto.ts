/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentResponseDto } from './AgentResponseDto';
export type AgentListResponseDto = {
    /**
     * List of agents
     */
    items: Array<AgentResponseDto>;
    /**
     * Total number of agents matching the query
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per page
     */
    limit: number;
    /**
     * Total number of pages
     */
    totalPages: number;
};

