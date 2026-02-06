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
