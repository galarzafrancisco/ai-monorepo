/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GlobalSearchResultDto = {
    /**
     * Result ID
     */
    id: string;
    /**
     * Result type
     */
    type: GlobalSearchResultDto.type;
    /**
     * Result title/name
     */
    title: string;
    /**
     * Match confidence score (0-1, higher is better)
     */
    score: number;
    /**
     * Frontend URL path to navigate to this resource
     */
    url: string;
};
export namespace GlobalSearchResultDto {
    /**
     * Result type
     */
    export enum type {
        TASK = 'task',
        CONTEXT_BLOCK = 'context_block',
        AGENT = 'agent',
        PROJECT = 'project',
        TAG = 'tag',
        TOOL = 'tool',
    }
}

