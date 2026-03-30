/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ThreadMessageResponseDto } from './ThreadMessageResponseDto.js';
export type ListThreadMessagesResponseDto = {
    /**
     * List of messages
     */
    items: Array<ThreadMessageResponseDto>;
    /**
     * Total number of messages
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

