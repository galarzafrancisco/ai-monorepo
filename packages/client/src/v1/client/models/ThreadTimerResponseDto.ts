/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ThreadTimerKind } from './ThreadTimerKind.js';
export type ThreadTimerResponseDto = {
    /**
     * Timer ID; use it to cancel the timer
     */
    id: string;
    /**
     * reminder fires once; schedule fires every period, up to maxIterations times
     */
    kind: ThreadTimerKind;
    /**
     * What the threads agent wants to be reminded of
     */
    reason: string;
    /**
     * Seconds between firings (null for a reminder)
     */
    periodSeconds: number | null;
    /**
     * Most times the timer fires
     */
    maxIterations: number;
    /**
     * Times the timer has fired so far
     */
    firedCount: number;
    /**
     * When the timer fires next (UTC)
     */
    nextFireAt: string;
    /**
     * When the timer was set (UTC)
     */
    createdAt: string;
};

