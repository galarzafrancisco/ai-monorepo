/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateMappingDto = {
    /**
     * MCP scope ID to map from
     */
    scopeId: string;
    /**
     * Connection ID that owns this mapping
     */
    connectionId: string;
    /**
     * Downstream OAuth scope string
     */
    downstreamScope: string;
};

