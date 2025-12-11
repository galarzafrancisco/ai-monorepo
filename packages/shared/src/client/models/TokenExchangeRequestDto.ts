/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenExchangeRequestDto = {
    /**
     * Grant type for token exchange as defined in RFC 8693
     */
    grant_type: TokenExchangeRequestDto.grant_type;
    /**
     * The access token that represents the identity of the party on behalf of whom the request is being made
     */
    subject_token: string;
    /**
     * Type identifier for the subject_token as defined in RFC 8693
     */
    subject_token_type: TokenExchangeRequestDto.subject_token_type;
    /**
     * Resource server URL that the client wants to access with the exchanged token
     */
    resource: string;
    /**
     * Optional space-delimited list of scopes for the exchanged token
     */
    scope?: string;
};
export namespace TokenExchangeRequestDto {
    /**
     * Grant type for token exchange as defined in RFC 8693
     */
    export enum grant_type {
        URN_IETF_PARAMS_OAUTH_GRANT_TYPE_TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange',
    }
    /**
     * Type identifier for the subject_token as defined in RFC 8693
     */
    export enum subject_token_type {
        URN_IETF_PARAMS_OAUTH_TOKEN_TYPE_ACCESS_TOKEN = 'urn:ietf:params:oauth:token-type:access_token',
    }
}

