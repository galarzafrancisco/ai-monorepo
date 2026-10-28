/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GithubAuthType } from './GithubAuthType.js';
export type CreateGithubConnectionDto = {
    /**
     * Display name
     */
    name: string;
    /**
     * The address of the GitHub to connect to: https://github.com (the default), a GitHub Enterprise Server (https://github.acme.com) or a GitHub Enterprise Cloud with data residency (https://acme.ghe.com).
     */
    baseUrl?: string | null;
    authType: GithubAuthType;
    /**
     * The personal access token (PAT), or the whole PEM private key of the GitHub App (App). Stored encrypted and never returned.
     */
    secret: string;
    /**
     * GitHub App id. Required for App connections.
     */
    appId?: string | null;
    /**
     * GitHub App installation id. Required for App connections.
     */
    installationId?: string | null;
    /**
     * Repository owners (users or organisations) this connection is used for. Empty: the account the credential acts as.
     */
    owners?: Array<string>;
};

