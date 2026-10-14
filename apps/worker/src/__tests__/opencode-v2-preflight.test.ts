import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenCodeV2AgentRunner } from '../runners/opencode-v2/OpenCodeV2AgentRunner.js';
import {
  OpencodeStartupAbortedError,
  OpencodeStartupError,
  startOpencodeV2Server,
} from '../runners/opencode-v2/server.js';
import { OPENCODE_PINNED_VERSION, OpencodeVersionMismatchError } from '../runners/opencode-v2/version.js';

/**
 * Fake `opencode` binary: prints `version` for `--version` and records a
 * marker file if it is ever invoked with `serve`, so tests can prove the
 * preflight rejected the binary before a server process was started.
 */
function fakeOpencode(dir: string, version: string, { versionDelaySec = 0 } = {}) {
  const bin = join(dir, `opencode-${version}`);
  const serveMarker = join(dir, `served-${version}`);
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then',
      versionDelaySec ? `  sleep ${versionDelaySec}` : '  :',
      `  echo "${version}"`,
      '  exit 0',
      'fi',
      `if [ "$1" = "serve" ]; then touch "${serveMarker}"; fi`,
      'exit 1',
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  return { bin, serveMarker };
}

function withTmp(fn: (dir: string) => Promise<void>) {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oc2-preflight-'));
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test(
  'startOpencodeV2Server rejects a mismatched CLI before spawning serve',
  withTmp(async (dir) => {
    const { bin, serveMarker } = fakeOpencode(dir, '1.18.29');
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin, startupTimeoutMs: 5_000 }),
      (error: unknown) =>
        error instanceof OpencodeVersionMismatchError &&
        error.source === 'cli' &&
        error.actual === '1.18.29' &&
        error.expected === OPENCODE_PINNED_VERSION,
    );
    assert.equal(existsSync(serveMarker), false, 'serve must never be invoked');
  }),
);

test(
  'startOpencodeV2Server rejects a mismatched CLI on an explicit port too',
  withTmp(async (dir) => {
    const { bin, serveMarker } = fakeOpencode(dir, '0.0.1');
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin, port: 1, startupTimeoutMs: 5_000 }),
      OpencodeVersionMismatchError,
    );
    assert.equal(existsSync(serveMarker), false);
  }),
);

test(
  'a matching CLI passes preflight and proceeds to serve',
  withTmp(async (dir) => {
    const { bin, serveMarker } = fakeOpencode(dir, OPENCODE_PINNED_VERSION);
    // The fake exits on `serve`, so startup fails after the preflight passed.
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin, port: 1, startupTimeoutMs: 5_000 }),
      OpencodeStartupError,
    );
    assert.equal(existsSync(serveMarker), true, 'serve is invoked once the preflight passes');
  }),
);

test(
  'missing CLI binary fails preflight with a startup error',
  withTmp(async (dir) => {
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin: join(dir, 'does-not-exist'), startupTimeoutMs: 5_000 }),
      (error: unknown) => error instanceof OpencodeStartupError && /preflight/.test(error.message),
    );
  }),
);

test(
  'CLI preflight is bounded by the startup timeout and abortable',
  withTmp(async (dir) => {
    const { bin, serveMarker } = fakeOpencode(dir, OPENCODE_PINNED_VERSION, { versionDelaySec: 5 });
    const started = Date.now();
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin, startupTimeoutMs: 200 }),
      (error: unknown) => error instanceof OpencodeStartupError && /timed out/.test(error.message),
    );
    assert.ok(Date.now() - started < 2_000, 'preflight must respect the startup deadline');

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(
      startOpencodeV2Server({ cwd: dir, config: {}, bin, startupTimeoutMs: 5_000, signal: controller.signal }),
      OpencodeStartupAbortedError,
    );
    assert.equal(existsSync(serveMarker), false);
  }),
);

test(
  'OpenCodeV2AgentRunner fails a run with a mismatched CLI before any server starts',
  withTmp(async (dir) => {
    const { bin, serveMarker } = fakeOpencode(dir, '1.18.29');
    const workspaces = join(dir, 'workspaces');
    const cwd = join(workspaces, 'task', 'agent');
    mkdirSync(cwd, { recursive: true });
    let serverStarted = false;
    const runner = new OpenCodeV2AgentRunner(
      { providerId: 'mock', modelId: 'mock-model' },
      { bin, workspaceRoot: workspaces, startupTimeoutMs: 5_000, onLifecycle: () => (serverStarted = true) },
    );
    await assert.rejects(
      runner.run(
        {
          taskId: 'task-1',
          executionId: 'exec-1',
          prompt: 'hi',
          cwd,
          baseUrl: 'http://127.0.0.1:1',
          accessToken: 'unused',
          mcpServers: {},
          agentSlug: 'tester',
        },
        { onHeartbeat: () => undefined, onEvent: () => undefined },
      ),
      OpencodeVersionMismatchError,
    );
    assert.equal(serverStarted, false);
    assert.equal(existsSync(serveMarker), false);
  }),
);
