/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateBlockDto = {
    /**
     * Title of the context block
     */
    title: string;
    /**
     * Markdown content of the block
     */
    content: string;
    /**
     * Array of tag names to associate with the block
     */
    tagNames?: Array<string>;
    /**
     * Parent block ID for nesting
     */
    parentId?: string;
};

