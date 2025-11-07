/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RegisterClientDto = {
    /**
     * Array of redirect URIs for authorization callbacks (supports http and localhost for MCP clients)
     */
    redirect_uris: Array<string>;
    /**
     * Authentication method for the token endpoint (MCP clients use "none")
     */
    token_endpoint_auth_method: RegisterClientDto.token_endpoint_auth_method;
    /**
     * Grant types the client will use. Must include authorization_code and refresh_token per MCP requirements.
     */
    grant_types: Array<'authorization_code' | 'refresh_token'>;
    /**
     * Array of the OAuth 2.0 response type strings that the client can use at the authorization endpoint.
     */
    response_types: Array<'code'>;
    /**
     * Human-readable name of the client
     */
    client_name: string;
    /**
     * Requested scopes for the client
     */
    scope?: Array<string>;
    /**
     * Contact emails for the client registration
     */
    contacts?: Array<string>;
    /**
     * Terms of service URI for the client registration
     */
    tos_uri?: string;
    client_uri?: string;
    logo_uri?: string;
    policy_uri?: string;
    jwks_uri?: string;
    jwks?: string;
    software_id?: string;
    software_version?: string;
};
export namespace RegisterClientDto {
    /**
     * Authentication method for the token endpoint (MCP clients use "none")
     */
    export enum token_endpoint_auth_method {
        NONE = 'none',
    }
}

