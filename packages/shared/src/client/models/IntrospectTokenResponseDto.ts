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
     * Token type, always Bearer for MCP clients
     */
    token_type: IntrospectTokenResponseDto.token_type;
    /**
     * Client identifier associated with the token
     */
    client_id: string;
    /**
     * Subject of the token (resource owner or actor)
     */
    sub: Record<string, any>;
    /**
     * Audience that should accept this token
     */
    aud: (string | Array<string>);
    /**
     * Issuer that minted the token
     */
    iss: Record<string, any>;
    /**
     * Unique token identifier for replay detection
     */
    jti: Record<string, any>;
    /**
     * Expiration timestamp (seconds since Unix epoch)
     */
    exp: Record<string, any>;
    /**
     * Issued-at timestamp (seconds since Unix epoch)
     */
    iat: Record<string, any>;
    /**
     * Not-before timestamp (seconds since Unix epoch)
     */
    nbf?: number;
    /**
     * Granted scopes (space-delimited) for display purposes
     */
    scope?: string;
    /**
     * MCP server identifier the token is scoped to
     */
    server_identifier: Record<string, any>;
    /**
     * Resource URL that was used during authorization
     */
    resource: Record<string, any>;
    /**
     * Version of the MCP server contract
     */
    version: Record<string, any>;
};
export namespace IntrospectTokenResponseDto {
    /**
     * Token type, always Bearer for MCP clients
     */
    export enum token_type {
        BEARER = 'Bearer',
    }
}

