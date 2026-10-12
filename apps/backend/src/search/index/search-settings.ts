/**
 * Every tunable of indexing and search. Stored as one JSON row; anything not
 * stored uses the default below, so new settings need no migration.
 */
export type SearchSettings = {
  /** Use embeddings at all. Off means keyword and fuzzy title search only. */
  semanticEnabled: boolean;

  // Indexing. Changing these re-embeds every item.
  /** Target size of a passage, in characters. */
  chunkSizeChars: number;
  /** Characters repeated between consecutive passages cut from one long paragraph. */
  chunkOverlapChars: number;

  // Retrieval.
  /** Prefix that tells an instruction-aware embedding model what a query is for. Empty for models that take none. */
  queryInstruction: string;
  /** How long a search waits for the query embedding before answering without semantic matches. */
  queryEmbeddingTimeoutMs: number;
  /** How many candidates each strategy contributes before the lists are merged. */
  candidatesPerStrategy: number;
  /** Lowest cosine similarity (0-1) at which a passage counts as a semantic match. */
  semanticMinSimilarity: number;
  /**
   * How far below the best semantic match a passage may be and still count.
   * Trims the tail when something matches well, without hiding weaker matches
   * when nothing does. 1 turns it off.
   */
  semanticMaxGap: number;
  /**
   * Lowest cover density at which a text counts as a keyword match. Density
   * measures how close together the query's terms occur; it filters out long
   * texts that merely contain every term somewhere. 0 turns the filter off.
   */
  keywordMinDensity: number;
  /** Lowest trigram word similarity (0-1) at which a title counts as a fuzzy match. */
  fuzzyMinSimilarity: number;

  // Ranking.
  /** Reciprocal rank fusion constant. Higher flattens the difference between ranks. */
  rrfK: number;
  keywordWeight: number;
  fuzzyTitleWeight: number;
  semanticWeight: number;
  /** Added when the query is the item's title, and half of it when the title starts with the query. */
  exactTitleBoost: number;
  /** Multiplier applied to finished tasks, so open work wins ties. 1 turns it off. */
  doneTaskMultiplier: number;

  // Results.
  /** Longest excerpt returned with a result, in characters. */
  excerptMaxChars: number;
  defaultLimit: number;
};

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  semanticEnabled: true,
  chunkSizeChars: 1600,
  chunkOverlapChars: 200,
  queryInstruction:
    'Given a search query, retrieve relevant passages that answer the query',
  queryEmbeddingTimeoutMs: 2000,
  candidatesPerStrategy: 50,
  semanticMinSimilarity: 0.45,
  semanticMaxGap: 0.15,
  keywordMinDensity: 0.005,
  fuzzyMinSimilarity: 0.5,
  rrfK: 60,
  keywordWeight: 1,
  fuzzyTitleWeight: 1,
  semanticWeight: 1,
  exactTitleBoost: 0.02,
  doneTaskMultiplier: 0.9,
  excerptMaxChars: 1200,
  defaultLimit: 10,
};

type NumericKey = {
  [K in keyof SearchSettings]: SearchSettings[K] extends number ? K : never;
}[keyof SearchSettings];

/** Inclusive bounds of each numeric setting. The HTTP DTO validates against the same table. */
export const SEARCH_SETTINGS_BOUNDS: Record<NumericKey, { min: number; max: number; integer: boolean }> = {
  chunkSizeChars: { min: 200, max: 8000, integer: true },
  chunkOverlapChars: { min: 0, max: 1000, integer: true },
  queryEmbeddingTimeoutMs: { min: 100, max: 30_000, integer: true },
  candidatesPerStrategy: { min: 5, max: 500, integer: true },
  semanticMinSimilarity: { min: 0, max: 1, integer: false },
  semanticMaxGap: { min: 0, max: 1, integer: false },
  keywordMinDensity: { min: 0, max: 1, integer: false },
  fuzzyMinSimilarity: { min: 0.1, max: 1, integer: false },
  rrfK: { min: 1, max: 1000, integer: true },
  keywordWeight: { min: 0, max: 10, integer: false },
  fuzzyTitleWeight: { min: 0, max: 10, integer: false },
  semanticWeight: { min: 0, max: 10, integer: false },
  exactTitleBoost: { min: 0, max: 1, integer: false },
  doneTaskMultiplier: { min: 0, max: 1, integer: false },
  excerptMaxChars: { min: 100, max: 20_000, integer: true },
  defaultLimit: { min: 1, max: 100, integer: true },
};

export const MAX_QUERY_INSTRUCTION_CHARS = 500;

/**
 * Defaults overlaid with whatever valid values are stored. Unknown keys and
 * values of the wrong type or out of bounds are ignored, so a row written by
 * a newer or older version cannot break search.
 */
export function resolveSearchSettings(stored: unknown): SearchSettings {
  const settings: SearchSettings = { ...DEFAULT_SEARCH_SETTINGS };
  if (!stored || typeof stored !== 'object') {
    return settings;
  }
  const values = stored as Record<string, unknown>;

  if (typeof values.semanticEnabled === 'boolean') {
    settings.semanticEnabled = values.semanticEnabled;
  }
  if (
    typeof values.queryInstruction === 'string' &&
    values.queryInstruction.length <= MAX_QUERY_INSTRUCTION_CHARS
  ) {
    settings.queryInstruction = values.queryInstruction.trim();
  }
  for (const key of Object.keys(SEARCH_SETTINGS_BOUNDS) as NumericKey[]) {
    const value = values[key];
    const bounds = SEARCH_SETTINGS_BOUNDS[key];
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= bounds.min &&
      value <= bounds.max &&
      (!bounds.integer || Number.isInteger(value))
    ) {
      settings[key] = value;
    }
  }
  // An overlap as long as the passage would never advance through the text.
  settings.chunkOverlapChars = Math.min(
    settings.chunkOverlapChars,
    Math.floor(settings.chunkSizeChars / 2),
  );
  return settings;
}
