/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MappingResponseDto = {
    /**
     * System-generated UUID for the mapping
     */
    id: string;
    /**
     * MCP scope identifier
     */
    scopeId: string;
    /**
     * UUID of the MCP server
     */
    serverId: string;
    /**
     * UUID of the downstream OAuth connection
     */
    connectionId: string;
    /**
     * Downstream provider scope string
     */
    downstreamScope: string;
    /**
     * Timestamp when the mapping was created
     */
    createdAt: string;
    /**
     * Timestamp when the mapping was last updated
     */
    updatedAt: string;
};

