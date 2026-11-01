/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ImportAgentIssueDto } from './ImportAgentIssueDto.js';
export type ImportAgentsResponseDto = {
    /**
     * Slugs created by this import
     */
    created: Array<string>;
    /**
     * Slugs updated by this import
     */
    updated: Array<string>;
    /**
     * Agents that were not created or updated
     */
    failed: Array<ImportAgentIssueDto>;
    /**
     * Agents that were created or updated, but with a related record skipped
     */
    warnings: Array<ImportAgentIssueDto>;
};

