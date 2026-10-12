import { Injectable } from '@nestjs/common';
import { SearchResultType } from '../search/enums';
import { IndexSearchService } from '../search/index/index-search.service';
import { IndexSearchResult } from '../search/search.types';

export type GlobalSearchInput = {
  query: string;
  limit?: number;
  types?: SearchResultType[];
};

export type GlobalSearchResult = IndexSearchResult & {
  /** Frontend path that opens the result. */
  url: string;
};

/** Search across every kind of item, as one list ranked by relevance. */
@Injectable()
export class GlobalSearchService {
  constructor(private readonly indexSearchService: IndexSearchService) {}

  async search(input: GlobalSearchInput): Promise<GlobalSearchResult[]> {
    const results = await this.indexSearchService.search({
      query: input.query,
      limit: input.limit,
      types: input.types,
    });
    return results.map((result) => ({ ...result, url: urlFor(result) }));
  }
}

function urlFor(result: IndexSearchResult): string {
  switch (result.type) {
    case SearchResultType.TASK:
      return `/tasks/task/${result.id}`;
    case SearchResultType.CONTEXT_BLOCK:
      return `/context/block/${result.id}`;
    case SearchResultType.TOOL:
      return `/tools/tool/${result.id}`;
    case SearchResultType.AGENT:
      return `/agents/agent/${String(result.meta.slug ?? '')}`;
    case SearchResultType.PROJECT:
      return `/settings/projects`;
  }
}
