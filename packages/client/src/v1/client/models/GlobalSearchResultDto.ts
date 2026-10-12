/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchMatchField } from './SearchMatchField.js';
import type { SearchResultType } from './SearchResultType.js';
import type { SearchStrategy } from './SearchStrategy.js';
export type GlobalSearchResultDto = {
    /**
     * Result ID
     */
    id: string;
    /**
     * Result type
     */
    type: SearchResultType;
    /**
     * Result title/name
     */
    title: string;
    /**
     * Relevance from 0 to 1, for ordering results within this response. Not comparable between searches.
     */
    score: number;
    /**
     * Frontend URL path to navigate to this resource
     */
    url: string;
    /**
     * The search strategies that found this result
     */
    matchedBy: Array<SearchStrategy>;
    /**
     * Which part of the item matched best: its title, a passage of its text, or a comment on it
     */
    matchedOn: SearchMatchField;
    /**
     * Text from the item: the passage or comment that matched, or the start of the item when only its title matched. Empty when the item has no text.
     */
    excerpt: string;
    /**
     * True when the excerpt is the item's whole text (or the whole comment). False when it is only a part.
     */
    excerptIsComplete: boolean;
    /**
     * ID of the comment the excerpt comes from. Null unless a comment matched.
     */
    commentId?: string | null;
    /**
     * Who wrote the matching comment. Null unless a comment matched.
     */
    commentAuthor?: string | null;
};

