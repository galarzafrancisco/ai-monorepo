/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatEventDto } from './ChatEventDto';
export type AdkSessionResponseDto = {
    /**
     * Unique identifier for the session
     */
    id: string;
    /**
     * Name of the ADK app
     */
    appName: string;
    /**
     * User ID associated with the session
     */
    userId: string;
    /**
     * Session state data
     */
    state: Record<string, any>;
    /**
     * List of chat events in the session
     */
    events: Array<ChatEventDto>;
    /**
     * Unix timestamp of the last update to the session
     */
    lastUpdateTime: number;
};

