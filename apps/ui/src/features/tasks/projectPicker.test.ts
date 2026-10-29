import { describe, expect, it } from 'vitest';
import { projectSections, type RankableProject } from './projectSuggestions';
import {
  applyProjectTagChange,
  hitsForQuery,
  initialHighlightIndex,
  isCurrentProjectChoice,
} from './projectPicker';

function project(id: string, overrides: Partial<RankableProject> = {}): RankableProject {
  return {
    id,
    slug: id,
    tagName: `project:${id}`,
    description: '',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function enterTarget(
  projects: RankableProject[],
  query: string,
  search: { query: string; hits: RankableProject[] },
  selectedProjectId: string | null,
) {
  const hits = hitsForQuery(query, search);
  const sections = projectSections(projects, query, [], new Map(), hits);
  const rows = sections.flatMap((section) => section.projects.map((item) => ({ kind: 'project' as const, id: item.id })));
  const index = initialHighlightIndex(rows, query, selectedProjectId);
  return rows[index];
}

describe('hitsForQuery', () => {
  const alpha = project('alpha', { description: 'only the previous search returned this' });

  it('drops the previous response when the query changes, so Enter cannot select it', () => {
    const pending = { query: 'alpha', hits: [alpha] };
    const target = enterTarget([], 'zzzz', pending, null);
    expect(hitsForQuery('zzzz', pending)).toEqual([]);
    expect(target).toBeUndefined();
    expect(enterTarget([project('beta')], 'beta', pending, null)?.id).toBe('beta');
  });

  it('keeps hits once they belong to the current query', () => {
    const search = { query: 'alpha', hits: [alpha] };
    expect(enterTarget([], 'alpha', search, null)?.id).toBe('alpha');
    expect(enterTarget([], '  alpha  ', search, null)?.id).toBe('alpha');
  });
});

describe('isCurrentProjectChoice', () => {
  it('treats an unresolved project tag as assigned, so clearing it commits', async () => {
    expect(isCurrentProjectChoice({ kind: 'clear' }, null, true)).toBe(false);
    expect(isCurrentProjectChoice({ kind: 'clear' }, null, false)).toBe(true);
    expect(isCurrentProjectChoice({ kind: 'project', id: 'taico' }, 'taico', true)).toBe(true);

    const removed: string[] = [];
    await applyProjectTagChange(
      [{ id: 'orphan', name: 'project:ghost' }],
      null,
      async () => { throw new Error('clear must not add a tag'); },
      async (id) => { removed.push(id); },
    );
    expect(removed).toEqual(['orphan']);
  });

  it('does not treat another project as the current one when the tag is unresolved', () => {
    expect(isCurrentProjectChoice({ kind: 'project', id: 'other' }, null, true)).toBe(false);
  });
});
