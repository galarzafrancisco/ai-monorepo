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
    /**
     * URL of the home page of the client
     */
    client_uri?: string;
    /**
     * URL that references a logo for the client application
     */
    logo_uri?: string;
    /**
     * URL that the client provides to the end-user to read about how the profile data will be used
     */
    policy_uri?: string;
    /**
     * URL for the client JSON Web Key Set document. If specified, must not include jwks parameter
     */
    jwks_uri?: string;
    /**
     * Client JSON Web Key Set document value as a JSON string. If specified, must not include jwks_uri parameter
     */
    jwks?: string;
    /**
     * Unique identifier string assigned by the client developer or software publisher
     */
    software_id?: string;
    /**
     * Version identifier string for the client software
     */
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

