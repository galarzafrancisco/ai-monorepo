/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChecksStatus } from './ChecksStatus.js';
import type { PullRequestState } from './PullRequestState.js';
import type { ReviewDecision } from './ReviewDecision.js';
export type PullRequestResponseDto = {
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
     * Null until Taico has read the pull request
     */
    title: string | null;
    /**
     * Null until Taico has read the pull request
     */
    state: PullRequestState | null;
    draft: boolean;
    authorLogin: string | null;
    headRef: string | null;
    baseRef: string | null;
    additions: number | null;
    deletions: number | null;
    changedFiles: number | null;
    /**
     * Conversation and review comments
     */
    commentCount: number | null;
    /**
     * CI of the latest commit
     */
    checksStatus: ChecksStatus;
    checksTotal: number;
    checksPassed: number;
    checksFailed: number;
    checksPending: number;
    /**
     * Names of the failing checks
     */
    failedChecks: Array<string>;
    reviewDecision: ReviewDecision;
    /**
     * Reviewers whose latest review approves
     */
    approvals: number;
    mergedAt: string | null;
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

