/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueLabelResponseDto } from './IssueLabelResponseDto.js';
import type { IssueState } from './IssueState.js';
import type { IssueStateReason } from './IssueStateReason.js';
export type IssueResponseDto = {
    id: string;
    /**
     * owner/repo#number on github.com, host/owner/repo#number on a GitHub Enterprise; lower case
     */
    key: string;
    /**
     * github.com, or the host of a GitHub Enterprise
     */
    host: string;
    owner: string;
    repo: string;
    number: number;
    url: string;
    /**
     * Null until Taico has read the issue
     */
    title: string | null;
    /**
     * Null until Taico has read the issue
     */
    state: IssueState | null;
    /**
     * Why it is closed (completed, not planned, duplicate), or reopened
     */
    stateReason: IssueStateReason | null;
    /**
     * The link is an /issues/ link to a pull request
     */
    isPullRequest: boolean;
    authorLogin: string | null;
    labels: Array<IssueLabelResponseDto>;
    assignees: Array<string>;
    milestone: string | null;
    commentCount: number | null;
    closedAt: string | null;
    /**
     * When GitHub says it last changed
     */
    githubUpdatedAt: string | null;
    /**
     * When Taico last read it from GitHub
     */
    lastFetchedAt: string | null;
    /**
     * Why the last read failed; null when it worked
     */
    lastError: string | null;
};

