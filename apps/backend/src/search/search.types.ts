import { SearchMatchField, SearchResultType, SearchStrategy } from './enums';

/**
 * Generic search types
 */

/**
 * Input for the generic search
 */
export type SearchInput<T> = {
  /** Array of items to search through */
  items: T[];
  /** Field name to use as the primary search field (e.g., 'name', 'title') */
  primaryField: keyof T;
  /** Field name to use as the secondary search field (e.g., 'description', 'content') */
  secondaryField?: keyof T;
  /** Additional fields to include with lower relevance weighting */
  additionalFields?: Array<keyof T>;
  /** The search query string */
  query: string;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Minimum score threshold (0-1, default: 0.3) */
  threshold?: number;
};

/**
 * Output result from the search
 */
export type SearchResult<T> = {
  /** The item's ID */
  id: string;
  /** The primary field value */
  primaryField: string;
  /** Match confidence score (0-1, higher is better) */
  score: number;
  /** The original item */
  item: T;
};

/**
 * Generic entity that can be searched
 * Must have an id and the fields specified in SearchInput
 */
export type SearchableEntity = {
  id: string;
  [key: string]: any;
};

/**
 * Index search types
 */

/** What an index row was built from. A comment is found on its own but opens its task. */
export type SearchEntityType = `${SearchResultType}` | 'comment';

export type IndexSearchInput = {
  query: string;
  /** Only these kinds of result. Everything when omitted. */
  types?: readonly SearchResultType[];
  limit?: number;
};

export type IndexSearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  /**
   * Relevance between 0 and 1, comparable only within one response. 1 means
   * first in every strategy that ran, with an exact title match.
   */
  score: number;
  matchedBy: SearchStrategy[];
  /** The result's position in each strategy's list. Explains the score; not part of the API. */
  ranks: Partial<Record<SearchStrategy, number>>;
  matchedOn: SearchMatchField;
  /**
   * Text from the item: the passage that matched, or the start of the item
   * when only its title matched. Empty when the item has no text.
   */
  excerpt: string;
  /** True when the excerpt is the item's whole text (or the whole comment). */
  excerptIsComplete: boolean;
  /** Set when the excerpt is a comment. */
  commentId: string | null;
  commentAuthor: string | null;
  /** Extra facts about the result, such as a task's status or an agent's slug. */
  meta: Record<string, unknown>;
};
