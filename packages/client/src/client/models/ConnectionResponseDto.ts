/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ConnectionResponseDto = {
    /**
     * System-generated UUID for the connection
     */
    id: string;
    /**
     * UUID of the MCP server this connection belongs to
     */
    serverId: string;
    /**
     * Friendly name for operators to distinguish connections
     */
    friendlyName: string;
    /**
     * OAuth client ID
     */
    clientId: string;
    /**
     * OAuth client secret (masked for security)
     */
    clientSecret?: string | null;
    /**
     * OAuth authorization URL
     */
    authorizeUrl: string;
    /**
     * OAuth token URL
     */
    tokenUrl: string;
    /**
     * Timestamp when the connection was created
     */
    createdAt: string;
    /**
     * Timestamp when the connection was last updated
     */
    updatedAt: string;
};

