/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ClientRegistrationResponseDto = {
    /**
     * Unique client identifier
     */
    client_id: string;
    /**
     * Client secret for confidential clients
     */
    client_secret?: Record<string, any> | null;
    /**
     * Human-readable name of the client
     */
    client_name: string;
    /**
     * Array of redirect URIs for authorization callbacks
     */
    redirect_uris: Array<string>;
    /**
     * Grant types the client is authorized to use
     */
    grant_types: Array<'authorization_code' | 'refresh_token' | 'client_credentials'>;
    /**
     * Authentication method for the token endpoint
     */
    token_endpoint_auth_method: ClientRegistrationResponseDto.token_endpoint_auth_method;
    /**
     * Scopes granted to the client
     */
    scope?: Array<string> | null;
    /**
     * Contact emails for the client
     */
    contacts?: Array<string> | null;
    /**
     * PKCE code challenge method
     */
    code_challenge_method?: Record<string, any> | null;
    /**
     * Client registration timestamp (ISO 8601)
     */
    client_id_issued_at: string;
};
export namespace ClientRegistrationResponseDto {
    /**
     * Authentication method for the token endpoint
     */
    export enum token_endpoint_auth_method {
        CLIENT_SECRET_BASIC = 'client_secret_basic',
        CLIENT_SECRET_POST = 'client_secret_post',
        NONE = 'none',
    }
}

