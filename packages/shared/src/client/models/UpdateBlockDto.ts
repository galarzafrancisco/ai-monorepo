/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateBlockDto = {
    /**
     * Updated title of the context block
     */
    title?: string;
    /**
     * Updated markdown content of the block
     */
    content?: string;
    /**
     * Array of tag names to associate with the block
     */
    tagNames?: Array<string>;
    /**
     * Parent block ID (null to remove parent)
     */
    parentId?: string | null;
    /**
     * Order within siblings
     */
    order?: number;
};

