/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreatePageDto = {
    /**
     * Title of the wiki page
     */
    title: string;
    /**
     * Markdown content of the page
     */
    content: string;
    /**
     * Author of the page
     */
    author: string;
    /**
     * Array of tag names to associate with the page
     */
    tagNames?: Array<string>;
};

