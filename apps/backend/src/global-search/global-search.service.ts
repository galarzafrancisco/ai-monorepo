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
 * Who may see a hit of each type. The index only searches the caller's
 * workspace; every hit is also checked against its row, so a row that moved
 * or was deleted since it was indexed is not shown. The record is total: a new
 * result type does not compile until it says who sees it. Each rule keeps a
 * hit only when its row is in the caller's workspace.
 */
const VISIBILITY: Record<SearchResultType, string> = {
  [SearchResultType.TASK]: `SELECT id FROM tasks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.CONTEXT_BLOCK]: `SELECT id FROM context_blocks WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.PROJECT]: `SELECT id FROM projects WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.THREAD]: `SELECT id FROM threads WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.AGENT]: `SELECT id FROM agents WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
  [SearchResultType.TOOL]: `SELECT id FROM mcp_servers WHERE workspace_id = $1 AND "deletedAt" IS NULL AND id = ANY($2::uuid[])`,
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
      workspaceId,
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
