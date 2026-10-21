import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceInstructions } from '../prompt.js';

test('no workspace section for zero or one repo without skipped projects', () => {
  assert.deepEqual(buildWorkspaceInstructions(undefined), []);
  assert.deepEqual(buildWorkspaceInstructions({ cwd: '/w', repos: [], skipped: [] }), []);
  assert.deepEqual(
    buildWorkspaceInstructions({
      cwd: '/w/repo',
      repos: [{ slug: 'a', repoUrl: 'u', dir: '/w/repo' }],
      skipped: [],
    }),
    [],
  );
});

test('lists every repo folder when several projects are prepared', () => {
  const text = buildWorkspaceInstructions({
    cwd: '/w/repos',
    repos: [
      { slug: 'taico', repoUrl: 'git@x:taico.git', dir: '/w/repos/taico' },
      { slug: 'docs', repoUrl: 'git@x:docs.git', dir: '/w/repos/docs' },
    ],
    skipped: [],
  }).join('\n');
  assert.match(text, /tagged with 2 projects/);
  assert.match(text, /project:taico -> \/w\/repos\/taico \(git@x:taico\.git\)/);
  assert.match(text, /project:docs -> \/w\/repos\/docs/);
});

test('calls out project tags that could not be prepared', () => {
  const text = buildWorkspaceInstructions({
    cwd: '/w/repo',
    repos: [{ slug: 'taico', repoUrl: 'u', dir: '/w/repo' }],
    skipped: [
      { slug: 'ghost', reason: 'not_found' },
      { slug: 'norepo', reason: 'no_repo_url' },
    ],
  }).join('\n');
  assert.match(text, /project:taico is at \/w\/repo/);
  assert.match(text, /project:ghost \(project not found\)/);
  assert.match(text, /project:norepo \(project has no repository URL\)/);
});
