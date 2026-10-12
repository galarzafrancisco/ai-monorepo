/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SearchIndexTypeStatusDto = {
    /**
     * Kind of indexed item
     */
    type: string;
    /**
     * Indexed items of this kind
     */
    documents: number;
    /**
     * Of those, how many have up-to-date embeddings
     */
    embedded: number;
};

