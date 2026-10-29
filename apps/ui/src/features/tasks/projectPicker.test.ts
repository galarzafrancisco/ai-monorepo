import { describe, expect, it } from 'vitest';
import { projectSections, type RankableProject } from './projectSuggestions';
import {
  applyProjectTagChange,
  hitsForQuery,
  initialHighlightIndex,
  isCurrentProjectChoice,
  removeProjectAssignment,
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
  selectedProjectIds: string[] = [],
) {
  const hits = hitsForQuery(query, search);
  const sections = projectSections(projects, query, [], new Map(), hits);
  const rows = sections.flatMap((section) => section.projects.map((item) => ({ kind: 'project' as const, id: item.id })));
  const index = initialHighlightIndex(rows, query, selectedProjectIds);
  return rows[index];
}

describe('hitsForQuery', () => {
  const alpha = project('alpha', { description: 'only the previous search returned this' });

  it('drops the previous response when the query changes, so Enter cannot select it', () => {
    const pending = { query: 'alpha', hits: [alpha] };
    const target = enterTarget([], 'zzzz', pending);
    expect(hitsForQuery('zzzz', pending)).toEqual([]);
    expect(target).toBeUndefined();
    expect(enterTarget([project('beta')], 'beta', pending)?.id).toBe('beta');
  });

  it('keeps hits once they belong to the current query', () => {
    const search = { query: 'alpha', hits: [alpha] };
    expect(enterTarget([], 'alpha', search)?.id).toBe('alpha');
    expect(enterTarget([], '  alpha  ', search)?.id).toBe('alpha');
  });
});

describe('initialHighlightIndex', () => {
  it('starts on an assigned project when the query is empty', () => {
    const rows = [
      { kind: 'project', id: 'alpha' },
      { kind: 'project', id: 'beta' },
      { kind: 'clear', id: 'clear' },
    ];
    expect(initialHighlightIndex(rows, '', ['beta'])).toBe(1);
    expect(initialHighlightIndex(rows, 'be', ['beta'])).toBe(0);
  });
});

describe('isCurrentProjectChoice', () => {
  it('treats an unresolved project tag as assigned, so clearing it commits', async () => {
    expect(isCurrentProjectChoice({ kind: 'clear' }, [], true)).toBe(false);
    expect(isCurrentProjectChoice({ kind: 'clear' }, [], false)).toBe(true);
    expect(isCurrentProjectChoice({ kind: 'project', id: 'taico' }, ['taico', 'other'], true)).toBe(true);
    expect(isCurrentProjectChoice({ kind: 'project', id: 'other' }, ['taico', 'other'], true)).toBe(true);

    const removed: string[] = [];
    await applyProjectTagChange(
      [{ id: 'orphan', name: 'project:ghost' }],
      null,
      async () => { throw new Error('clear must not add a tag'); },
      async (id) => { removed.push(id); },
    );
    expect(removed).toEqual(['orphan']);
  });

  it('does not treat another project as assigned when the tag is unresolved', () => {
    expect(isCurrentProjectChoice({ kind: 'project', id: 'other' }, [], true)).toBe(false);
  });
});

describe('project assignments', () => {
  const tags = [
    { id: 'taico', name: 'project:taico' },
    { id: 'other', name: 'project:other' },
  ];

  it('adds a project without removing the ones already assigned', async () => {
    const added: string[] = [];
    const removed: string[] = [];
    await applyProjectTagChange(
      tags,
      { tagName: 'project:third' },
      async (name) => { added.push(name); },
      async (id) => { removed.push(id); },
    );
    expect(added).toEqual(['project:third']);
    expect(removed).toEqual([]);
  });

  it('does not add a project tag that is already assigned', async () => {
    const added: string[] = [];
    await applyProjectTagChange(tags, { tagName: 'project:taico' }, async (name) => { added.push(name); }, async () => {});
    expect(added).toEqual([]);
  });

  it('removes one project and leaves the others, including the last one', async () => {
    const removed: string[] = [];
    const remove = async (id: string) => { removed.push(id); };
    await removeProjectAssignment(tags, 'taico', remove);
    await removeProjectAssignment([{ id: 'other', name: 'project:other' }], 'other', remove);
    await removeProjectAssignment([], 'missing', remove);
    expect(removed).toEqual(['taico', 'other']);
  });

  it('clears every project tag, including when several remain', async () => {
    const removed: string[] = [];
    await applyProjectTagChange(
      tags,
      null,
      async () => { throw new Error('clear must not add a tag'); },
      async (id) => { removed.push(id); },
    );
    expect(removed).toEqual(['taico', 'other']);
  });
});
