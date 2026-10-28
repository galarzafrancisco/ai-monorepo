/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ThreadWatchKind } from './ThreadWatchKind.js';
export type ThreadWatchResponseDto = {
    id: string;
    kind: ThreadWatchKind;
    /**
     * What is watched, e.g. a pull request id
     */
    targetId: string;
    /**
     * How to show what is watched
     */
    targetLabel: string;
    targetUrl: string | null;
    /**
     * What the agent is waiting for
     */
    conditions: Array<string>;
    /**
     * The watch ends after its first notification
     */
    once: boolean;
    waitingFor: string | null;
    expiresAt: string;
    createdAt: string;
};

