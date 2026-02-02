/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenResponseDto = {
    /**
     * Opaque access token used to access protected resources
     */
    access_token: string;
    /**
     * Type of token issued (MCP clients always receive Bearer tokens)
     */
    token_type: TokenResponseDto.token_type;
    /**
     * Lifetime of the access token in seconds
     */
    expires_in: number;
    /**
     * Refresh token that can be exchanged for a new access token
     */
    refresh_token: string;
    /**
     * Space-delimited scopes that were granted for this token
     */
    scope?: string;
};
export namespace TokenResponseDto {
    /**
     * Type of token issued (MCP clients always receive Bearer tokens)
     */
    export enum token_type {
        BEARER = 'Bearer',
    }
}

