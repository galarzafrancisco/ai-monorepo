/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ServerResponseDto = {
    /**
     * System-generated UUID for the MCP server
     */
    id: string;
    /**
     * Human-readable unique identifier for the MCP server
     */
    providedId: string;
    /**
     * Display name of the MCP server
     */
    name: string;
    /**
     * Short description of the MCP server
     */
    description: string;
    /**
     * Transport type of the MCP server
     */
    type: ServerResponseDto.type;
    /**
     * URL that MCP Clients will use to connect to the server
     */
    url?: string;
    /**
     * Command used to start a stdio MCP server
     */
    cmd?: string;
    /**
     * Arguments passed to the stdio command
     */
    args?: Array<string>;
    /**
     * Timestamp when the server was created
     */
    createdAt: string;
    /**
     * Timestamp when the server was last updated
     */
    updatedAt: string;
};
export namespace ServerResponseDto {
    /**
     * Transport type of the MCP server
     */
    export enum type {
        HTTP = 'http',
        STDIO = 'stdio',
    }
}

