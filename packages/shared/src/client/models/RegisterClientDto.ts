/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RegisterClientDto = {
    /**
     * Human-readable name of the client
     */
    client_name: string;
    /**
     * Array of redirect URIs for authorization callbacks
     */
    redirect_uris: Array<string>;
    /**
     * Grant types the client will use. Must include authorization_code and refresh_token per MCP requirements.
     */
    grant_types: Array<'authorization_code' | 'refresh_token' | 'client_credentials'>;
    /**
     * Authentication method for the token endpoint
     */
    token_endpoint_auth_method: RegisterClientDto.token_endpoint_auth_method;
    /**
     * Requested scopes for the client
     */
    scope?: Array<string>;
    /**
     * Contact emails for the client registration
     */
    contacts?: Array<string>;
    /**
     * PKCE code challenge method. Must be S256 for authorization_code grant.
     */
    code_challenge_method?: string;
};
export namespace RegisterClientDto {
    /**
     * Authentication method for the token endpoint
     */
    export enum token_endpoint_auth_method {
        CLIENT_SECRET_BASIC = 'client_secret_basic',
        CLIENT_SECRET_POST = 'client_secret_post',
        NONE = 'none',
    }
}

