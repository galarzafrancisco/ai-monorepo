import { describe, expect, it } from 'vitest';
import { activityByProjectTag, matchesClearProject, projectSections, type RankableProject } from './projectSuggestions';

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

describe('projectSections', () => {
  it('puts remembered picks and projects with recent tasks first, not alphabetical', () => {
    const projects = [
      project('alpha', { updatedAt: '2026-10-01T00:00:00Z' }),
      project('zeta', { updatedAt: '2026-02-01T00:00:00Z' }),
      project('mid', { updatedAt: '2026-06-01T00:00:00Z' }),
    ];
    const activity = activityByProjectTag([
      { tags: [{ name: 'project:zeta' }], updatedAt: '2026-10-20T00:00:00Z' },
      { tags: [{ name: 'project:mid' }, { name: 'other' }], updatedAt: '2026-10-10T00:00:00Z' },
    ]);

    const sections = projectSections(projects, '', ['mid'], activity);
    expect(sections.map((section) => section.title)).toEqual(['Recent', 'All projects']);
    expect(sections[0].projects.map((item) => item.id)).toEqual(['mid', 'zeta']);
    expect(sections[1].projects.map((item) => item.id)).toEqual(['alpha']);
  });

  it('sorts a cold list by project update, newest first', () => {
    const projects = [
      project('alpha', { updatedAt: '2026-01-01T00:00:00Z' }),
      project('newer', { updatedAt: '2026-10-01T00:00:00Z' }),
    ];
    const sections = projectSections(projects, '', [], new Map());
    expect(sections).toEqual([{ title: 'All projects', projects: [projects[1], projects[0]] }]);
  });

  it('matches slug, description and a one-character typo, and requires every word', () => {
    const projects = [
      project('taico', { description: 'task board for agents' }),
      project('other', { description: 'unrelated' }),
      project('taiko', { description: 'drums' }),
    ];
    expect(projectSections(projects, 'taico', [], new Map())[0].projects.map((item) => item.id)).toEqual(['taico']);
    expect(projectSections(projects, 'board', [], new Map())[0].projects.map((item) => item.id)).toEqual(['taico']);
    expect(projectSections(projects, 'tico', [], new Map())[0].projects.map((item) => item.id)).toContain('taico');
    expect(projectSections(projects, 'taico unrelated', [], new Map())).toEqual([]);
  });

  it('appends server hits the local ranker missed', () => {
    const local = [project('alpha')];
    const remote = [project('beta', { description: 'something the local list did not score' })];
    const sections = projectSections(local, 'beta', [], new Map(), remote);
    expect(sections[0].projects.map((item) => item.id)).toEqual(['beta']);
  });
});

describe('matchesClearProject', () => {
  it('treats an empty query and clear-words as the no-project choice', () => {
    expect(matchesClearProject('')).toBe(true);
    expect(matchesClearProject('no project')).toBe(true);
    expect(matchesClearProject('no pro')).toBe(false);
    expect(matchesClearProject('taico')).toBe(false);
  });
});
