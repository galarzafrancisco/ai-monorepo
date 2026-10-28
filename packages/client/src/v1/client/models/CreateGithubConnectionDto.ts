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

