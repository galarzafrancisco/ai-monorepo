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
     * Human-readable name of the client
     */
    client_name: string;
    /**
     * Array of redirect URIs for authorization callbacks (supports http and localhost for MCP clients)
     */
    redirect_uris: Array<string>;
    /**
     * Grant types the client is authorized to use
     */
    grant_types: Array<'authorization_code' | 'refresh_token'>;
    /**
     * Authentication method for the token endpoint (MCP clients use "none")
     */
    token_endpoint_auth_method: ClientRegistrationResponseDto.token_endpoint_auth_method;
    /**
     * Scopes granted to the client
     */
    scope?: string | null;
    /**
     * Contact emails for the client
     */
    contacts?: Array<string> | null;
    /**
     * PKCE code challenge method
     */
    code_challenge_method?: Record<string, any> | null;
    /**
     * Time at which the client identifier was issued. The time is represented as the number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time of issuance.
     */
    client_id_issued_at: number;
};
export namespace ClientRegistrationResponseDto {
    /**
     * Authentication method for the token endpoint (MCP clients use "none")
     */
    export enum token_endpoint_auth_method {
        NONE = 'none',
    }
}

