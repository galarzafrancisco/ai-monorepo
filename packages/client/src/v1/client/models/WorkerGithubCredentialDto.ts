/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type WorkerGithubCredentialDto = {
    projectSlug: string;
    /**
     * HTTPS clone URL the token works with
     */
    cloneUrl: string;
    owner: string;
    repo: string;
    /**
     * Token for git over HTTPS and the GitHub API. Never log or store it.
     */
    token: string;
    /**
     * When the token stops working; null for a personal access token
     */
    expiresAt: string | null;
    authType: WorkerGithubCredentialDto.authType;
};
export namespace WorkerGithubCredentialDto {
    export enum authType {
        PAT = 'pat',
        APP = 'app',
    }
}

