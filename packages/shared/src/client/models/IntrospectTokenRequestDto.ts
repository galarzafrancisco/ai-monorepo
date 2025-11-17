/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IntrospectTokenRequestDto = {
    /**
     * Access or refresh token that should be validated
     */
    token: string;
    /**
     * Hint to help the server determine the token lookup strategy
     */
    token_type_hint?: IntrospectTokenRequestDto.token_type_hint;
    /**
     * Client identifier making the request (required for public MCP clients)
     */
    client_id: string;
    /**
     * Client secret for confidential clients (MCP clients typically omit this)
     */
    client_secret?: string | null;
};
export namespace IntrospectTokenRequestDto {
    /**
     * Hint to help the server determine the token lookup strategy
     */
    export enum token_type_hint {
        ACCESS_TOKEN = 'access_token',
        REFRESH_TOKEN = 'refresh_token',
    }
}

