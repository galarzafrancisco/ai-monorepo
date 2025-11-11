/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TagResponseDto } from './TagResponseDto';
export type PageSummaryDto = {
    /**
     * Unique identifier for the page
     */
    id: string;
    /**
     * Title of the wiki page
     */
    title: string;
    /**
     * Author of the wiki page
     */
    author: string;
    /**
     * Tags associated with the page
     */
    tags: Array<TagResponseDto>;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

