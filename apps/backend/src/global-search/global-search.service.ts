import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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

/**
 * The search index is not scoped by workspace yet (phase 3e). Until then a
 * hit of a workspace-owned type is kept only when its row is in the caller's
 * workspace. A thread's workspace is its state block's. Tools and agents are
 * not owned by a workspace yet (phases 3c and 3e), so they are kept.
 */
const WORKSPACE_ROWS: Partial<Record<SearchResultType, string>> = {
  [SearchResultType.TASK]: `SELECT id FROM tasks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.CONTEXT_BLOCK]: `SELECT id FROM context_blocks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.PROJECT]: `SELECT id FROM projects WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.THREAD]: `SELECT t.id FROM threads t
      JOIN context_blocks b ON b.id = t.state_context_block_id
     WHERE b.workspace_id = $1 AND t.id = ANY($2::uuid[])`,
};

/** Search across every kind of item, as one list ranked by relevance. */
@Injectable()
export class GlobalSearchService {
  constructor(
    private readonly indexSearchService: IndexSearchService,
    private readonly dataSource: DataSource,
  ) {}

  async search(
    workspaceId: string,
    input: GlobalSearchInput,
  ): Promise<GlobalSearchResult[]> {
    const results = await this.indexSearchService.search({
      query: input.query,
      limit: input.limit,
      types: input.types,
    });
    const visible = await this.idsInWorkspace(workspaceId, results);
    return results
      .filter((result) => !WORKSPACE_ROWS[result.type] || visible.has(result.id))
      .map((result) => ({ ...result, url: urlFor(result) }));
  }

  private async idsInWorkspace(
    workspaceId: string,
    results: IndexSearchResult[],
  ): Promise<Set<string>> {
    const visible = new Set<string>();
    for (const [type, sql] of Object.entries(WORKSPACE_ROWS)) {
      const ids = results.filter((result) => result.type === type).map((result) => result.id);
      if (ids.length === 0) {
        continue;
      }
      const rows: Array<{ id: string }> = await this.dataSource.query(sql, [workspaceId, ids]);
      rows.forEach((row) => visible.add(row.id));
    }
    return visible;
  }
}

function urlFor(result: IndexSearchResult): string {
  switch (result.type) {
    case SearchResultType.TASK:
      return `/tasks/task/${result.id}`;
    case SearchResultType.CONTEXT_BLOCK:
      return `/context/block/${result.id}`;
    case SearchResultType.THREAD:
      return `/threads/${result.id}`;
    case SearchResultType.TOOL:
      return `/tools/tool/${result.id}`;
    case SearchResultType.AGENT:
      return `/agents/agent/${String(result.meta.slug ?? '')}`;
    case SearchResultType.PROJECT:
      return `/projects`;
  }
}
