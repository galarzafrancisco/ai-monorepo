/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GithubConnectionMatch } from './GithubConnectionMatch.js';
import type { GithubConnectionResponseDto } from './GithubConnectionResponseDto.js';
import type { GithubRepositoryRefDto } from './GithubRepositoryRefDto.js';
import type { GithubWebhookSourceDto } from './GithubWebhookSourceDto.js';
export type ResolvedGithubConnectionResponseDto = {
    /**
     * The repository, or null when the URL is not on github.com or a GitHub Enterprise Taico has a connection to
     */
    repository: GithubRepositoryRefDto | null;
    /**
     * The connection Taico would use, or null when none fits (public github.com repositories are then read anonymously)
     */
    connection: GithubConnectionResponseDto | null;
    /**
     * Why: the project names it, it lists the repository owner, or it is the only connection
     */
    match: GithubConnectionMatch | null;
    /**
     * The most recent webhook covering the repository (set up on it, or on its whole owner), through any connection; null when GitHub never sent one
     */
    webhook: GithubWebhookSourceDto | null;
};

