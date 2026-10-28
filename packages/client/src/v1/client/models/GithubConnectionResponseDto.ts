/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GithubAuthType } from './GithubAuthType.js';
export type GithubConnectionResponseDto = {
    id: string;
    name: string;
    authType: GithubAuthType;
    appId: string | null;
    installationId: string | null;
    /**
     * Repository owners this connection is used for
     */
    owners: Array<string>;
    /**
     * Who GitHub says the connection acts as
     */
    accountLogin: string | null;
    lastVerifiedAt: string | null;
    /**
     * Why the last check with GitHub failed; null when it worked
     */
    lastError: string | null;
    /**
     * When GitHub last delivered a correctly signed webhook through this connection
     */
    lastWebhookAt: string | null;
    rowVersion: number;
    createdAt: string;
    updatedAt: string;
};

