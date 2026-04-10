/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RequestAgentExecutionTokenDto = {
    /**
     * Scopes to grant to the short-lived execution token. When omitted, scopes are derived from baseline system access plus assigned tool permissions.
     */
    scopes?: Array<string>;
    /**
     * Lifetime of the short-lived execution token in seconds. Defaults to the server MCP access token duration.
     */
    expirationSeconds?: number;
};

