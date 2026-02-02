/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateConnectionDto = {
    /**
     * Friendly name to identify this OAuth connection
     */
    friendlyName: string;
    /**
     * Unique identifier for this connection (alphanumeric, dash, underscore only). Used for token exchange.
     */
    providedId?: string;
    /**
     * OAuth client ID for the downstream provider
     */
    clientId: string;
    /**
     * OAuth client secret for the downstream provider
     */
    clientSecret: string;
    /**
     * OAuth authorization endpoint URL
     */
    authorizeUrl: string;
    /**
     * OAuth token endpoint URL
     */
    tokenUrl: string;
};

