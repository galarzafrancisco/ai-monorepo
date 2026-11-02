import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ExecutionWireEvents, type WorkerCapabilities } from '@taico/events';
import { detectWorkerCapabilities } from '../worker-capabilities.js';
import { ExecutionActivityGatewayClient } from '../execution-activity-gateway-client.js';

test('a hung CLI times out without blocking socket activity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'taico-capability-'));
  const oldPath = process.env.PATH;
  const oldKey = process.env.ANTHROPIC_API_KEY;
  try {
    await writeFile(join(directory, 'opencode'), '#!/bin/sh\nexec sleep 10\n');
    await chmod(join(directory, 'opencode'), 0o755);
    process.env.PATH = `${directory}:${oldPath}`;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const started = Date.now();
    const detection = detectWorkerCapabilities();
    let settled = false;
    void detection.then(() => { settled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false, 'the event loop can handle socket activity while probing');
    const result = await detection;
    assert.equal(result.opencode, false);
    assert.ok(Date.now() - started < 5_000, 'the CLI probe is bounded');
  } finally {
    process.env.PATH = oldPath;
    if (oldKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = oldKey;
    await rm(directory, { recursive: true, force: true });
  }
});

test('refreshes changed capabilities and retries a transient failed post', async (t) => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const directory = await mkdtemp(join(tmpdir(), 'taico-capability-client-'));
  const oldPath = process.env.PATH;
  const bin = join(directory, 'bin');
  await mkdir(bin);
  for (const name of ['opencode', 'git', 'gh']) {
    await writeFile(join(bin, name), '#!/bin/sh\nexit 0\n');
    await chmod(join(bin, name), 0o755);
  }
  process.env.PATH = `${bin}:${oldPath}`;
  const posts: WorkerCapabilities[] = [];
  let nextAck = false;
  class Transport extends EventEmitter {
    connected = true;
    emit(name: string, ...args: unknown[]): boolean {
      if (name === ExecutionWireEvents.WORKER_CAPABILITIES_POST) {
        posts.push(args[0] as WorkerCapabilities);
        (args[1] as (ack: { ok: boolean }) => void)({ ok: nextAck });
        super.emit('capability-post');
        return true;
      }
      return super.emit(name, ...args);
    }
    disconnect() { this.connected = false; this.emit('disconnect'); }
  }
  const client = new ExecutionActivityGatewayClient({
    baseUrl: 'http://unused', traceDirectory: directory, auth: {} as never,
  });
  const socket = new Transport();
  Object.assign(client, { socket });
  const internal = client as unknown as {
    handleHarnessesReportRequested(): void;
    startCapabilityRefreshTimer(): void;
  };
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    internal.startCapabilityRefreshTimer();
    const first = once(socket, 'capability-post');
    internal.handleHarnessesReportRequested();
    await first;
    await new Promise<void>((resolve) => setImmediate(resolve));
    nextAck = true;
    const retry = once(socket, 'capability-post');
    t.mock.timers.tick(10_000);
    await retry;
    assert.equal(posts[1].claudeAuthenticated, true);
    await new Promise<void>((resolve) => setImmediate(resolve));

    await writeFile(join(bin, 'opencode'), '#!/bin/sh\nexit 1\n');
    await chmod(join(bin, 'opencode'), 0o755);
    const refresh = once(socket, 'capability-post');
    t.mock.timers.tick(60_000);
    await refresh;
    assert.equal(posts[0].opencode, true);
    assert.equal(posts[2].opencode, false);
  } finally {
    t.mock.timers.reset();
    await client.stop();
    process.env.PATH = oldPath;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
    await rm(directory, { recursive: true, force: true });
  }
});
