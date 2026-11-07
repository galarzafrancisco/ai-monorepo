import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchResultType } from '../search/enums';
import { IndexSearchService } from '../search/index/index-search.service';
import { IndexSearchResult } from '../search/search.types';
import { holdsUnscopedModuleData } from '../workspaces/unscoped-modules';

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
 * Who may see a hit of each type. The search index is not scoped by workspace
 * yet (phase 3e), so every hit is checked against its row. The record is
 * total: a new result type does not compile until it says who sees it.
 * - SQL: kept only when the row is in the caller's workspace. A thread's
 *   workspace is its state block's.
 * - `unscoped`: agents and tools have no workspace yet (phases 3c and 3e),
 *   so they are default-workspace rows: other workspaces never see them.
 */
const VISIBILITY: Record<SearchResultType, string | 'unscoped'> = {
  [SearchResultType.TASK]: `SELECT id FROM tasks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.CONTEXT_BLOCK]: `SELECT id FROM context_blocks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.PROJECT]: `SELECT id FROM projects WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.THREAD]: `SELECT t.id FROM threads t
      JOIN context_blocks b ON b.id = t.state_context_block_id
     WHERE b.workspace_id = $1 AND t.id = ANY($2::uuid[])`,
  [SearchResultType.AGENT]: 'unscoped',
  [SearchResultType.TOOL]: 'unscoped',
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
    // Fails closed: a hit is shown only when its row was found visible.
    return results
      .filter((result) => visible.has(`${result.type}:${result.id}`))
      .map((result) => ({ ...result, url: urlFor(result) }));
  }

  /** `type:id` of every hit the workspace may see. */
  private async idsInWorkspace(
    workspaceId: string,
    results: IndexSearchResult[],
  ): Promise<Set<string>> {
    const visible = new Set<string>();
    for (const [type, rule] of Object.entries(VISIBILITY)) {
      const ids = results.filter((result) => result.type === type).map((result) => result.id);
      if (ids.length === 0) {
        continue;
      }
      if (rule === 'unscoped') {
        if (holdsUnscopedModuleData(workspaceId)) {
          ids.forEach((id) => visible.add(`${type}:${id}`));
        }
        continue;
      }
      const rows: Array<{ id: string }> = await this.dataSource.query(rule, [workspaceId, ids]);
      rows.forEach((row) => visible.add(`${type}:${row.id}`));
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
