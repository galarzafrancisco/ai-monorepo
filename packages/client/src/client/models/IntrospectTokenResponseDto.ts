/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IntrospectTokenResponseDto = {
    /**
     * Indicates whether the token is currently valid
     */
    active: boolean;
    /**
     * Token type, always Bearer for MCP clients. Only present when active is true.
     */
    token_type?: IntrospectTokenResponseDto.token_type;
    /**
     * Client identifier associated with the token. Only present when active is true.
     */
    client_id?: string;
    /**
     * Subject of the token (resource owner or actor). Only present when active is true.
     */
    sub?: Record<string, any>;
    /**
     * Audience that should accept this token. Only present when active is true.
     */
    aud?: (string | Array<string>);
    /**
     * Issuer that minted the token. Only present when active is true.
     */
    iss?: Record<string, any>;
    /**
     * Unique token identifier for replay detection. Only present when active is true.
     */
    jti?: Record<string, any>;
    /**
     * Expiration timestamp (seconds since Unix epoch). Only present when active is true.
     */
    exp?: Record<string, any>;
    /**
     * Issued-at timestamp (seconds since Unix epoch). Only present when active is true.
     */
    iat?: Record<string, any>;
    /**
     * Granted scopes (space-delimited) for display purposes
     */
    scope?: string;
    /**
     * MCP server identifier the token is scoped to
     */
    mcp_server_identifier?: Record<string, any>;
    /**
     * Resource URL that was used during authorization. Only present when active is true.
     */
    resource?: Record<string, any>;
    /**
     * Version of the MCP server contract. Only present when active is true.
     */
    version?: Record<string, any>;
};
export namespace IntrospectTokenResponseDto {
    /**
     * Token type, always Bearer for MCP clients. Only present when active is true.
     */
    export enum token_type {
        BEARER = 'Bearer',
    }
}

