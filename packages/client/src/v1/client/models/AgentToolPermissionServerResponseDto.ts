/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentToolPermissionServerResponseDto = {
    /**
     * MCP server UUID
     */
    id: string;
    /**
     * MCP server provided identifier
     */
    providedId: string;
    /**
     * MCP server name
     */
    name: string;
    /**
     * MCP server description
     */
    description: string;
    /**
     * MCP server transport type
     */
    type: AgentToolPermissionServerResponseDto.type;
    /**
     * HTTP endpoint for servers with http transport
     */
    url?: string;
    /**
     * Command for servers with stdio transport
     */
    cmd?: string;
    /**
     * Command arguments for servers with stdio transport
     */
    args?: Array<string>;
};
export namespace AgentToolPermissionServerResponseDto {
    /**
     * MCP server transport type
     */
    export enum type {
        HTTP = 'http',
        STDIO = 'stdio',
    }
}

