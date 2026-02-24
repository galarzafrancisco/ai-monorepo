/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateServerDto = {
    /**
     * Transport type of the MCP server
     */
    type?: UpdateServerDto.type;
    /**
     * Display name of the MCP server
     */
    name?: string;
    /**
     * Short description of the MCP server
     */
    description?: string;
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
};
export namespace UpdateServerDto {
    /**
     * Transport type of the MCP server
     */
    export enum type {
        HTTP = 'http',
        STDIO = 'stdio',
    }
}

