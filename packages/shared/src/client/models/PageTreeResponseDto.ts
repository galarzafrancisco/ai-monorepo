/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PageTreeResponseDto = {
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
     * Parent page ID (null if root page)
     */
    parentId: Record<string, any> | null;
    /**
     * Order within siblings
     */
    order: number;
    /**
     * Child pages
     */
    children: Array<PageTreeResponseDto>;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

