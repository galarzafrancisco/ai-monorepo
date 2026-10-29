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
     * Who authorizes calls to the server. `taico`: Taico is the OAuth authorization server and workers send the agent's Taico execution token. `external`: the server handles its own auth and receives no Taico credentials.
     */
    authType?: UpdateServerDto.authType;
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
    /**
     * Who authorizes calls to the server. `taico`: Taico is the OAuth authorization server and workers send the agent's Taico execution token. `external`: the server handles its own auth and receives no Taico credentials.
     */
    export enum authType {
        TAICO = 'taico',
        EXTERNAL = 'external',
    }
}

