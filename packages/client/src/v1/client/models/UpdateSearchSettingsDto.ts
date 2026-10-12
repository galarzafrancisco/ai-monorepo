/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateSearchSettingsDto = {
    /**
     * Use embeddings. When off, search uses keywords and fuzzy title matching only.
     */
    semanticEnabled?: boolean;
    /**
     * Target size of an embedded passage, in characters. Changing it re-embeds every item.
     */
    chunkSizeChars?: number;
    /**
     * Characters repeated between consecutive pieces of one over-long paragraph. Changing it re-embeds every item.
     */
    chunkOverlapChars?: number;
    /**
     * Instruction sent with each query to instruction-aware embedding models. Leave empty for models that take none.
     */
    queryInstruction?: string;
    /**
     * How long a search waits for the query embedding before answering without semantic matches, in milliseconds.
     */
    queryEmbeddingTimeoutMs?: number;
    /**
     * How many candidates each strategy contributes before the lists are merged.
     */
    candidatesPerStrategy?: number;
    /**
     * Lowest cosine similarity (0-1) at which a passage counts as a semantic match. Raise it to cut loosely related results.
     */
    semanticMinSimilarity?: number;
    /**
     * How far below the best semantic match a passage may be and still count. Trims the tail when something matches well. 1 turns it off.
     */
    semanticMaxGap?: number;
    /**
     * Lowest cover density at which a text counts as a keyword match. Filters out long texts that contain every term but far apart. 0 turns it off.
     */
    keywordMinDensity?: number;
    /**
     * Lowest trigram similarity (0-1) at which a title counts as a fuzzy match. Lower it to forgive more typos.
     */
    fuzzyMinSimilarity?: number;
    /**
     * Reciprocal rank fusion constant. Higher values flatten the difference between ranks.
     */
    rrfK?: number;
    /**
     * Weight of keyword matches in the merged ranking. 0 turns the strategy off.
     */
    keywordWeight?: number;
    /**
     * Weight of fuzzy title matches in the merged ranking. 0 turns the strategy off.
     */
    fuzzyTitleWeight?: number;
    /**
     * Weight of semantic matches in the merged ranking. 0 turns the strategy off.
     */
    semanticWeight?: number;
    /**
     * Added to the score when the query is the title; half of it when the title starts with the query.
     */
    exactTitleBoost?: number;
    /**
     * Score multiplier for finished tasks, so open work wins ties. 1 turns it off.
     */
    doneTaskMultiplier?: number;
    /**
     * Longest excerpt returned with a result, in characters. Shorter items are returned whole.
     */
    excerptMaxChars?: number;
    /**
     * Results returned when a search does not ask for a number.
     */
    defaultLimit?: number;
};

