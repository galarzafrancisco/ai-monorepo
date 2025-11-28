/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SessionResponseDto } from './SessionResponseDto';
export type SessionListResponseDto = {
    /**
     * List of sessions
     */
    items: Array<SessionResponseDto>;
    /**
     * Total number of sessions matching the filters
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per page
     */
    limit: number;
};

