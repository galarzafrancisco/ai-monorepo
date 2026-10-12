/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchIndexTypeStatusDto } from './SearchIndexTypeStatusDto.js';
export type SearchIndexStatusDto = {
    /**
     * Whether searches currently use embeddings
     */
    semanticActive: boolean;
    /**
     * Why semantic search is not active. Null when it is.
     */
    semanticInactiveReason?: string | null;
    /**
     * The embedding model in use. Null when there is no usable one.
     */
    embeddingModelId?: string | null;
    /**
     * Indexed items: tasks, comments, context blocks, tools, agents and projects
     */
    documents: number;
    /**
     * Items with up-to-date embeddings
     */
    embedded: number;
    /**
     * Items waiting to be embedded
     */
    pending: number;
    /**
     * Items whose last embedding attempt failed
     */
    failed: number;
    /**
     * The most recent embedding error. Null when nothing is failing.
     */
    lastError?: string | null;
    /**
     * The same counts per kind of item
     */
    byType: Array<SearchIndexTypeStatusDto>;
};

