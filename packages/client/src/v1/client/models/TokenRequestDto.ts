/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenRequestDto = {
    /**
     * Grant type that determines which parameters must be supplied
     */
    grant_type: TokenRequestDto.grant_type;
    /**
     * Client identifier issued during dynamic registration
     */
    client_id: string;
    /**
     * Authorization code that was issued by the /authorize endpoint
     */
    code?: string;
    /**
     * Redirect URI used during authorization (required when code is present)
     */
    redirect_uri?: string;
    /**
     * PKCE code verifier used to validate the authorization code exchange
     */
    code_verifier?: string;
    /**
     * Refresh token issued earlier by the authorization server
     */
    refresh_token?: string;
    /**
     * Optional list of scopes to narrow when refreshing a token (space-delimited)
     */
    scope?: string;
    /**
     * Optional resource indicator (RFC 8707) - identifies the target resource server
     */
    resource?: string;
};
export namespace TokenRequestDto {
    /**
     * Grant type that determines which parameters must be supplied
     */
    export enum grant_type {
        AUTHORIZATION_CODE = 'authorization_code',
        REFRESH_TOKEN = 'refresh_token',
    }
}

