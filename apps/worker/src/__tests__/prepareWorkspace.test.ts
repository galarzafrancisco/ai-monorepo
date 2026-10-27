import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareWorkspace } from '../helpers/prepareWorkspace.js';

let root: string;
let originA: string;
let originB: string;

function git(args: string[], cwd?: string) {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function makeOrigin(name: string): string {
  const dir = join(root, 'origins', name);
  git(['init', '-q', dir]);
  writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
  git(['add', '.'], dir);
  git(['commit', '-q', '-m', 'init'], dir);
  return dir;
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'worker-prepare-workspace-'));
  originA = makeOrigin('alpha');
  originB = makeOrigin('beta');
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

test('no repos: cwd is the base task/agent directory', async () => {
  const baseDir = join(root, 'ws-none');
  const workspace = await prepareWorkspace({
    taskId: 't1',
    agentId: 'a1',
    baseDir,
  });
  assert.equal(workspace.cwd, join(baseDir, 't1', 'a1'));
  assert.deepEqual(workspace.repos, []);
  assert.ok(existsSync(workspace.cwd));
});

test('one repo: keeps the legacy repo/ layout', async () => {
  const baseDir = join(root, 'ws-one');
  const workspace = await prepareWorkspace({
    taskId: 't1',
    agentId: 'a1',
    baseDir,
    repos: [{ slug: 'alpha', repoUrl: originA }],
  });
  const expected = join(baseDir, 't1', 'a1', 'repo');
  assert.equal(workspace.cwd, expected);
  assert.deepEqual(workspace.repos, [
    { slug: 'alpha', repoUrl: originA, dir: expected },
  ]);
  assert.equal(readFileSync(join(expected, 'README.md'), 'utf8'), '# alpha\n');
});

test('several repos: each project is cloned into its own folder', async () => {
  const baseDir = join(root, 'ws-many');
  const repos = [
    { slug: 'alpha', repoUrl: originA },
    { slug: 'beta', repoUrl: originB },
  ];
  const workspace = await prepareWorkspace({
    taskId: 't1',
    agentId: 'a1',
    baseDir,
    repos,
  });

  const reposRoot = join(baseDir, 't1', 'a1', 'repos');
  assert.equal(workspace.cwd, reposRoot);
  assert.deepEqual(
    workspace.repos.map((repo) => repo.dir),
    [join(reposRoot, 'alpha'), join(reposRoot, 'beta')],
  );
  assert.equal(
    readFileSync(join(reposRoot, 'alpha', 'README.md'), 'utf8'),
    '# alpha\n',
  );
  assert.equal(
    readFileSync(join(reposRoot, 'beta', 'README.md'), 'utf8'),
    '# beta\n',
  );
  assert.ok(existsSync(join(reposRoot, 'alpha', '.git')));
  assert.ok(existsSync(join(reposRoot, 'beta', '.git')));

  // Re-running on an existing workspace fetches instead of re-cloning.
  const again = await prepareWorkspace({
    taskId: 't1',
    agentId: 'a1',
    baseDir,
    repos,
  });
  assert.deepEqual(again, workspace);
});

test('several repos: colliding folder names get a unique suffix', async () => {
  const calls: Array<{ repo: string; dir: string }> = [];
  const workspace = await prepareWorkspace({
    taskId: 't1',
    agentId: 'a1',
    baseDir: join(root, 'ws-collide'),
    repos: [
      { slug: 'a/b', repoUrl: 'url-1' },
      { slug: 'a-b', repoUrl: 'url-2' },
    ],
    ensureRepo: async (props) => {
      calls.push(props);
    },
  });
  const reposRoot = join(root, 'ws-collide', 't1', 'a1', 'repos');
  assert.deepEqual(calls, [
    { repo: 'url-1', dir: join(reposRoot, 'a-b') },
    { repo: 'url-2', dir: join(reposRoot, 'a-b-2') },
  ]);
  assert.equal(workspace.cwd, reposRoot);
});

test('clone failure names the project that failed', async () => {
  await assert.rejects(
    prepareWorkspace({
      taskId: 't1',
      agentId: 'a1',
      baseDir: join(root, 'ws-fail'),
      repos: [
        { slug: 'alpha', repoUrl: originA },
        { slug: 'ghost', repoUrl: join(root, 'origins', 'does-not-exist') },
      ],
    }),
    /Failed to prepare repository for project "ghost"/,
  );
});

test('reports real clone and fetch progress for every repository', async () => {
  const progress: Array<{ slug: string; action: string; status: string }> = [];
  const options = {
    taskId: 't1',
    agentId: 'a1',
    baseDir: join(root, 'ws-progress'),
    repos: [
      { slug: 'alpha', repoUrl: originA },
      { slug: 'beta', repoUrl: originB },
    ],
    onRepository: (event: { slug: string; action: string; status: string }) => {
      progress.push(event);
    },
  };
  await prepareWorkspace(options);
  await prepareWorkspace(options);
  assert.deepEqual(
    progress.map(({ slug, action, status }) => `${slug}:${action}:${status}`),
    [
      'alpha:clone:running',
      'alpha:clone:completed',
      'beta:clone:running',
      'beta:clone:completed',
      'alpha:fetch:running',
      'alpha:fetch:completed',
      'beta:fetch:running',
      'beta:fetch:completed',
    ],
  );
});

test('reports the failing repo and preserves earlier successful progress', async () => {
  const progress: Array<{ slug: string; status: string }> = [];
  await assert.rejects(
    prepareWorkspace({
      taskId: 't1',
      agentId: 'a1',
      baseDir: join(root, 'ws-progress-failure'),
      repos: [
        { slug: 'alpha', repoUrl: originA },
        { slug: 'beta', repoUrl: originB },
      ],
      ensureRepo: async ({ repo }) => {
        if (repo === originB) throw new Error('clone failed');
      },
      onRepository: (event) => {
        progress.push(event);
      },
    }),
    /beta/,
  );
  assert.deepEqual(
    progress.map(({ slug, status }) => `${slug}:${status}`),
    ['alpha:running', 'alpha:completed', 'beta:running', 'beta:failed'],
  );
});
