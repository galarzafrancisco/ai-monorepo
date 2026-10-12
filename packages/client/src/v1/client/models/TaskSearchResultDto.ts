/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchMatchField } from './SearchMatchField.js';
import type { SearchStrategy } from './SearchStrategy.js';
export type TaskSearchResultDto = {
    /**
     * Task ID
     */
    id: string;
    /**
     * Task name/title
     */
    name: string;
    /**
     * Task status
     */
    status?: string | null;
    /**
     * Relevance from 0 to 1, for ordering results within this response. Not comparable between searches.
     */
    score: number;
    /**
     * The search strategies that found this result
     */
    matchedBy: Array<SearchStrategy>;
    /**
     * Which part of the task matched best: its name, its description, or one of its comments
     */
    matchedOn: SearchMatchField;
    /**
     * Text from the task: the comment or part of the description that matched, or the start of the description when only the name matched. Empty when the task has no description.
     */
    excerpt: string;
    /**
     * True when the excerpt is the whole description (or the whole comment). False when it is only a part.
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

