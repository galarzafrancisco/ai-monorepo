import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Event } from '@opencode-ai/sdk/v2';
import {
  finalAssistantText,
  isRunComplete,
  OpencodeV2EventFormatter,
  OwnedSessions,
  reconcileUsage,
  type SessionMessage,
} from '../runners/opencode-v2/session-events.js';
import {
  buildOpencodeConfig,
  DEFAULT_TAICO_OPENCODE_POLICY,
  resolveExecutionBoundary,
  WorkspaceBoundaryError,
} from '../runners/opencode-v2/policy.js';
import { assertServerVersion, OPENCODE_PINNED_VERSION, OpencodeVersionMismatchError } from '../runners/opencode-v2/version.js';

const ev = (type: string, properties: Record<string, unknown>) => ({ id: 'e', type, properties }) as unknown as Event;

function assistant(id: string, opts: { input?: number; output?: number; cost?: number; completed?: boolean; error?: unknown; text?: string } = {}): SessionMessage {
  return {
    info: {
      id,
      sessionID: 's',
      role: 'assistant',
      time: { created: 1, ...(opts.completed === false ? {} : { completed: 2 }) },
      ...(opts.error ? { error: opts.error } : {}),
      parentID: 'u',
      modelID: 'm',
      providerID: 'p',
      mode: 'build',
      agent: 'build',
      path: { cwd: '/', root: '/' },
      cost: opts.cost ?? 0,
      tokens: { input: opts.input ?? 0, output: opts.output ?? 0, reasoning: 0, cache: { read: 0, write: 0 } },
    },
    parts: opts.text ? [{ id: `p-${id}`, sessionID: 's', messageID: id, type: 'text', text: opts.text }] : [],
  } as SessionMessage;
}

const user = (id: string): SessionMessage =>
  ({ info: { id, sessionID: 's', role: 'user', time: { created: 1 } }, parts: [] }) as unknown as SessionMessage;

test('OwnedSessions accepts root + spawned children only', () => {
  const owned = new OwnedSessions('root');
  assert.equal(owned.accept(ev('session.idle', { sessionID: 'root' })), true);
  assert.equal(owned.accept(ev('session.idle', { sessionID: 'other' })), false);
  assert.equal(owned.accept(ev('server.connected', {})), false);
  owned.accept(ev('session.created', { sessionID: 'child', info: { id: 'child', parentID: 'root' } }));
  assert.equal(owned.accept(ev('message.part.delta', { sessionID: 'child' })), true);
  owned.accept(ev('session.created', { sessionID: 'x', info: { id: 'x', parentID: 'other' } }));
  assert.equal(owned.has('x'), false);
});

test('isRunComplete requires idle status AND a finished assistant reply', () => {
  assert.equal(isRunComplete('s', { s: { type: 'busy' } }, [user('u'), assistant('a')]), false);
  assert.equal(isRunComplete('s', {}, [user('u')]), false, 'prompt not admitted yet');
  assert.equal(isRunComplete('s', {}, [user('u'), assistant('a', { completed: false })]), false);
  assert.equal(isRunComplete('s', {}, [user('u'), assistant('a')]), true);
  assert.equal(isRunComplete('s', {}, [user('u'), assistant('a', { completed: false, error: { name: 'APIError' } })]), true);
});

test('reconcileUsage sums every assistant message', () => {
  const usage = reconcileUsage([user('u'), assistant('a', { input: 10, output: 2, cost: 0.5 }), assistant('b', { input: 5, output: 1, cost: 0.25 })]);
  assert.equal(usage.inputTokens, 15);
  assert.equal(usage.outputTokens, 3);
  assert.equal(usage.totalTokens, 18);
  assert.equal(usage.cost, 0.75);
  assert.equal(usage.assistantMessages, 2);
});

test('finalAssistantText returns the last non-empty assistant text', () => {
  assert.equal(finalAssistantText([user('u'), assistant('a', { text: 'first' }), assistant('b')]), 'first');
  assert.equal(finalAssistantText([user('u'), assistant('a', { text: 'first' }), assistant('b', { text: 'last' })]), 'last');
});

test('formatter emits finished parts once and reports tool start once', () => {
  const f = new OpencodeV2EventFormatter('bot');
  const text = (end?: number) => ev('message.part.updated', { sessionID: 's', part: { id: 't1', type: 'text', text: 'hi', time: { start: 1, end } } });
  assert.equal(f.format(text()), null);
  assert.equal(f.format(text(2)), '💬 @bot: hi');
  assert.equal(f.format(text(2)), null);
  const tool = (status: string) => ev('message.part.updated', { sessionID: 's', part: { id: 'k', type: 'tool', tool: 'bash', state: { status } } });
  assert.equal(f.toolStarted(tool('pending')), null);
  assert.equal(f.toolStarted(tool('running')), 'bash');
  assert.equal(f.toolStarted(tool('completed')), null);
});

test('config always carries Taico policy and MCP, never OpenCode defaults', () => {
  const cfg = buildOpencodeConfig({
    mcp: { tasks: { type: 'http', url: 'http://x/mcp', headers: { Authorization: 'Bearer t' } } },
    policy: DEFAULT_TAICO_OPENCODE_POLICY,
    extra: { permission: { bash: 'allow' }, mcp: { evil: { type: 'local', command: ['x'] } } } as any,
  });
  assert.deepEqual(Object.keys(cfg.mcp!), ['tasks']);
  assert.equal((cfg.mcp!.tasks as any).oauth, false);
  assert.deepEqual(Object.keys(cfg.permission as object), ['*', 'external_directory', 'question', 'doom_loop']);
  assert.equal(cfg.autoupdate, false);
  assert.equal(cfg.share, 'disabled');
});

test('resolveExecutionBoundary rejects cwd outside the root, including via symlink', () => {
  const root = mkdtempSync(join(tmpdir(), 'oc2-boundary-'));
  try {
    const ws = join(root, 'ws');
    const inside = join(ws, 'task', 'agent');
    const outside = join(root, 'outside');
    mkdirSync(inside, { recursive: true });
    mkdirSync(outside);
    symlinkSync(outside, join(ws, 'link'));
    assert.equal(resolveExecutionBoundary(inside, ws).endsWith(join('task', 'agent')), true);
    assert.throws(() => resolveExecutionBoundary(outside, ws), WorkspaceBoundaryError);
    assert.throws(() => resolveExecutionBoundary(join(ws, 'link'), ws), WorkspaceBoundaryError);
    assert.throws(() => resolveExecutionBoundary(ws, ws), WorkspaceBoundaryError);
    assert.throws(() => resolveExecutionBoundary('relative/path', ws), WorkspaceBoundaryError);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('server version must match the pin', () => {
  assert.equal(assertServerVersion({ healthy: true, version: OPENCODE_PINNED_VERSION }), OPENCODE_PINNED_VERSION);
  assert.throws(() => assertServerVersion({ healthy: true, version: '1.18.29' }), OpencodeVersionMismatchError);
  assert.throws(() => assertServerVersion({ healthy: false, version: OPENCODE_PINNED_VERSION }));
});
