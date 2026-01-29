import { Injectable, Logger } from '@nestjs/common';
import Fuse, { type FuseOptionKey } from 'fuse.js';
import { SearchInput, SearchResult, SearchableEntity } from './search.types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  /**
   * Generic fuzzy search using Fuse.js
   *
   * @param input - Search input with items, fields, and query
   * @returns Array of search results sorted by match confidence (best matches first)
   */
  search<T extends SearchableEntity>(input: SearchInput<T>): SearchResult<T>[] {
    const {
      items,
      primaryField,
      secondaryField,
      query,
      limit = 10,
      threshold = 0.3,
    } = input;

    this.logger.debug({
      message: 'Performing search',
      query,
      itemCount: items.length,
      primaryField,
      secondaryField,
      limit,
      threshold,
    });

    // Build Fuse.js keys configuration
    // Primary field has higher weight (0.7) than secondary field (0.3)
    const keys: FuseOptionKey<T>[] = [
      {
        name: primaryField as string,
        weight: 0.7,
      },
    ];

    if (secondaryField) {
      keys.push({
        name: secondaryField as string,
        weight: 0.3,
      });
    }

    // Configure Fuse.js
    const fuse = new Fuse(items, {
      keys,
      includeScore: true,
      threshold, // 0.0 = perfect match, 1.0 = match anything
      ignoreLocation: true, // Don't care where in the string the match is
      useExtendedSearch: false,
      minMatchCharLength: 1,
    });

    // Perform search
    const fuseResults = fuse.search(query);

    this.logger.debug({
      message: 'Search completed',
      resultCount: fuseResults.length,
      limitedCount: Math.min(fuseResults.length, limit),
    });

    // Map Fuse results to our SearchResult format
    // Note: Fuse.js score is inverted (lower is better), so we convert to (1 - score)
    const results: SearchResult<T>[] = fuseResults
      .slice(0, limit)
      .map((fuseResult) => ({
        id: fuseResult.item.id,
        primaryField: String(fuseResult.item[primaryField]),
        score: 1 - (fuseResult.score ?? 0), // Convert to higher-is-better
        item: fuseResult.item,
      }));

    return results;
  }
}
