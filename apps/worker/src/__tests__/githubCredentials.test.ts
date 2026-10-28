import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureRepo } from '../helpers/ensureRepo.js';
import { GITHUB_CREDENTIAL_KEY, removeTokenDir, tokenDir, writeTokenFile } from '../helpers/githubCredentials.js';

let root: string;
let origin: string;

function git(args: string[], options: { cwd?: string; input?: string } = {}): string {
  return execFileSync('git', args, {
    cwd: options.cwd,
    input: options.input,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_TERMINAL_PROMPT: '0',
    },
  }).toString();
}

/** What git would send to github.com for this repository. */
function credentialFor(dir: string): string {
  return git(['-C', dir, 'credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' });
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'taico-gh-creds-'));
  origin = join(root, 'origin');
  git(['init', '-q', origin]);
  writeFileSync(join(origin, 'README.md'), 'hello');
  git(['add', '.'], { cwd: origin });
  git(['commit', '-q', '-m', 'init'], { cwd: origin });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

test('writes tokens readable by the worker only, in a directory outside the workspace', () => {
  const dir = tokenDir(join(root, 'work'), 'exec-1');
  const file = writeTokenFile(dir, 'my project', 'ghs_secret');
  assert.equal(readFileSync(file, 'utf8'), 'ghs_secret');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.ok(file.includes('.taico-credentials'));
  removeTokenDir(dir);
  assert.equal(existsSync(dir), false);
});

test("answers git with the token, without putting it in the repository's config or remote", async () => {
  const dir = join(root, 'clone');
  const tokens = tokenDir(join(root, 'work'), 'exec-2');
  const tokenFile = writeTokenFile(tokens, 'proj', "ghs_it's-secret");

  await ensureRepo({ repo: origin, dir, tokenFile });

  const fill = credentialFor(dir);
  assert.match(fill, /username=x-access-token/);
  assert.match(fill, /password=ghs_it's-secret/);
  const config = readFileSync(join(dir, '.git', 'config'), 'utf8');
  assert.ok(!config.includes('ghs_'), 'the token itself is never written to git config');

  // A run without a token removes the helper again.
  await ensureRepo({ repo: origin, dir });
  assert.throws(() => git(['-C', dir, 'config', '--local', '--get-all', GITHUB_CREDENTIAL_KEY]));
  removeTokenDir(tokens);
});
