/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchMatchField } from './SearchMatchField.js';
import type { SearchStrategy } from './SearchStrategy.js';
export type BlockSearchResultDto = {
    /**
     * Block ID
     */
    id: string;
    /**
     * Block title
     */
    title: string;
    /**
     * Relevance from 0 to 1, for ordering results within this response. Not comparable between searches.
     */
    score: number;
    /**
     * The search strategies that found this result
     */
    matchedBy: Array<SearchStrategy>;
    /**
     * Which part of the block matched best: its title or a passage of its content
     */
    matchedOn: SearchMatchField;
    /**
     * Text from the block: the passage that matched, or the start of the content when only the title matched. Empty when the block has no content.
     */
    excerpt: string;
    /**
     * True when the excerpt is the block's whole content. False when it is only a part.
     */
    excerptIsComplete: boolean;
};

