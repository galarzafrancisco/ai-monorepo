/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenExchangeResponseDto = {
    /**
     * The newly issued access token after successful exchange
     */
    access_token: string;
    /**
     * Type identifier for the issued token as defined in RFC 8693
     */
    issued_token_type: string;
    /**
     * Type of token issued, always Bearer for MCP clients
     */
    token_type: string;
    /**
     * Lifetime of the access token in seconds
     */
    expires_in: number;
    /**
     * Space-delimited list of scopes granted for the exchanged token
     */
    scope: string;
};

