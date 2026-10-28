/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateGithubConnectionDto = {
    /**
     * Display name
     */
    name?: string;
    /**
     * The address of the GitHub to connect to. Changing it checks the credential again.
     */
    baseUrl?: string;
    /**
     * A new token or private key. Leave out to keep the current one.
     */
    secret?: string;
    /**
     * GitHub App id
     */
    appId?: string | null;
    /**
     * GitHub App installation id
     */
    installationId?: string | null;
    /**
     * Repository owners this connection is used for
     */
    owners?: Array<string>;
};

