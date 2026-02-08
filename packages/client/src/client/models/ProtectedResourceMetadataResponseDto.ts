/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProtectedResourceMetadataResponseDto = {
    /**
     * Resource URL associated with the protected resource metadata
     */
    resource: string;
    /**
     * Authorization servers that can be used to access this resource
     */
    authorization_servers: Array<string>;
    /**
     * Scopes supported by this protected resource
     */
    scopes_supported: Array<string>;
    /**
     * Bearer token transport methods supported by this resource
     */
    bearer_methods_supported: Array<string>;
    /**
     * Human-readable name of the resource
     */
    resource_name: string;
};

