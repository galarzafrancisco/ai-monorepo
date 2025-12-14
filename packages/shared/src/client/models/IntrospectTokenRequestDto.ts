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
     * Client identifier for optional validation against the token claims. Per RFC 7662, this is not required - the client_id is extracted from the token itself.
     */
    client_id?: string;
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

