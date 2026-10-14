import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProjectSlugsFromTags,
  resolveProjectRepos,
  toRepoDirName,
} from '../helpers/projectRepos.js';

test('getProjectSlugsFromTags returns every project tag, deduped, in order', () => {
  const slugs = getProjectSlugsFromTags([
    { name: 'code' },
    { name: 'project:taico' },
    { name: 'project:docs-site' },
    { name: 'project:taico' },
    { name: 'project:' },
    { name: 'projects:nope' },
  ]);
  assert.deepEqual(slugs, ['taico', 'docs-site']);
});

test('getProjectSlugsFromTags handles missing tags', () => {
  assert.deepEqual(getProjectSlugsFromTags(undefined), []);
  assert.deepEqual(getProjectSlugsFromTags(null), []);
  assert.deepEqual(getProjectSlugsFromTags([]), []);
});

test('resolveProjectRepos separates cloneable repos from missing projects/repos', async () => {
  const notFound = Object.assign(new Error('Not found'), { status: 404 });
  const projects: Record<string, { repoUrl?: string | null } | null | Error> = {
    a: { repoUrl: 'git@example.com:a.git' },
    b: { repoUrl: '' },
    c: null,
    d: notFound,
    e: { repoUrl: ' https://example.com/e.git ' },
    f: { repoUrl: null },
  };
  const result = await resolveProjectRepos(['a', 'b', 'c', 'd', 'e', 'f'], async (slug) => {
    const value = projects[slug];
    if (value instanceof Error) throw value;
    return value;
  });

  assert.deepEqual(result.repos, [
    { slug: 'a', repoUrl: 'git@example.com:a.git' },
    { slug: 'e', repoUrl: 'https://example.com/e.git' },
  ]);
  assert.deepEqual(result.skipped, [
    { slug: 'b', reason: 'no_repo_url' },
    { slug: 'c', reason: 'not_found' },
    { slug: 'd', reason: 'not_found' },
    { slug: 'f', reason: 'no_repo_url' },
  ]);
});

test('resolveProjectRepos rethrows unexpected lookup errors', async () => {
  const serverError = Object.assign(new Error('boom'), { status: 500 });
  await assert.rejects(
    resolveProjectRepos(['a'], async () => {
      throw serverError;
    }),
    serverError,
  );
});

test('toRepoDirName produces a safe single path segment', () => {
  assert.equal(toRepoDirName('taico'), 'taico');
  assert.equal(toRepoDirName('my.proj_1-x'), 'my.proj_1-x');
  assert.equal(toRepoDirName('../evil'), '-evil');
  assert.equal(toRepoDirName('a/b c'), 'a-b-c');
  assert.equal(toRepoDirName('..'), 'project');
});
