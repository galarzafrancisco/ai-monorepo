/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ContextTagResponseDto } from './ContextTagResponseDto';
export type PageResponseDto = {
    /**
     * Unique identifier for the page
     */
    id: string;
    /**
     * Title of the wiki page
     */
    title: string;
    /**
     * Markdown content of the wiki page
     */
    content: string;
    /**
     * Author of the wiki page
     */
    author: string;
    /**
     * Tags associated with the page
     */
    tags: Array<ContextTagResponseDto>;
    /**
     * Parent page ID (null if root page)
     */
    parentId: Record<string, any> | null;
    /**
     * Order within siblings
     */
    order: number;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

