/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AuthorizationServerMetadataDto = {
    /**
     * Issuer identifier for the MCP authorization server
     */
    issuer: string;
    /**
     * Authorization endpoint for initiating OAuth 2.0 authorization code flows
     */
    authorization_endpoint: string;
    /**
     * Dynamic client registration endpoint for MCP integrations
     */
    registration_endpoint: string;
    /**
     * Scopes supported by this MCP authorization server
     */
    scopes_supported: Array<string>;
    /**
     * OAuth 2.0 response types supported by this authorization server
     */
    response_types_supported: Array<string>;
    /**
     * OAuth 2.0 grant types supported by this authorization server
     */
    grant_types_supported: Array<'authorization_code' | 'refresh_token'>;
    /**
     * Client authentication methods supported by the token endpoint
     */
    token_endpoint_auth_methods_supported: Array<string>;
    /**
     * PKCE code challenge methods supported by this authorization server
     */
    code_challenge_methods_supported: Array<string>;
};

