/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ServerResponseDto } from './ServerResponseDto';
export type ServerListResponseDto = {
    /**
     * List of MCP servers
     */
    items: Array<ServerResponseDto>;
    /**
     * Total number of servers
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
};

