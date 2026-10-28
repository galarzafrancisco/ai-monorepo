import { describe, expect, it } from 'vitest';
import { blockedDependencyIds, idPrefixFromQuery, suggestDependencies } from './dependencySuggestions';
import type { Task } from './types';

const actor = (id: string) => ({ id, slug: id, displayName: id, type: 'human' }) as unknown as Task['createdByActor'];

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    description: '',
    status: 'NOT_STARTED',
    assigneeActor: null,
    comments: [],
    artefacts: [],
    inputRequests: [],
    tags: [],
    createdByActor: actor('creator'),
    dependsOnIds: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  } as Task;
}

const tag = (name: string) => ({ id: name, name }) as Task['tags'][number];

describe('blockedDependencyIds', () => {
  it('blocks the task, its dependencies, and anything that depends on it, transitively', () => {
    const current = task('a', { dependsOnIds: ['b'] });
    const pool = [current, task('b'), task('c', { dependsOnIds: ['a'] }), task('d', { dependsOnIds: ['c'] }), task('e')];
    expect([...blockedDependencyIds(current, pool)].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('suggestDependencies', () => {
  it('puts related tasks first with their reasons, open before shipped', () => {
    const current = task('a', { tags: [tag('project:taico'), tag('code')], assigneeActor: actor('dev') });
    const pool = [
      current,
      task('same-project', { tags: [tag('project:taico')], updatedAt: '2026-10-02T00:00:00Z' }),
      task('shipped-same-project', { tags: [tag('project:taico'), tag('code')], status: 'DONE' }),
      task('same-assignee', { assigneeActor: actor('dev') }),
      task('unrelated-new', { updatedAt: '2026-10-09T00:00:00Z' }),
      task('unrelated-old'),
    ];
    const { related, recent } = suggestDependencies(current, pool);
    expect(related.map((item) => item.task.id)).toEqual(['same-project', 'same-assignee', 'shipped-same-project']);
    expect(related[0].reasons).toEqual(['Same project']);
    expect(related[2].reasons).toEqual(['Same project', 'Tag code']);
    expect(recent.map((item) => item.task.id)).toEqual(['unrelated-new', 'unrelated-old']);
  });
});

describe('idPrefixFromQuery', () => {
  it('reads a short id with or without #', () => {
    expect(idPrefixFromQuery('#5FC5ec')).toBe('5fc5ec');
    expect(idPrefixFromQuery('d03ca8')).toBe('d03ca8');
    expect(idPrefixFromQuery('auth')).toBeNull();
    expect(idPrefixFromQuery('abc')).toBeNull();
  });
});
