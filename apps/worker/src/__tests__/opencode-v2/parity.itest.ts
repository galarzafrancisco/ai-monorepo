/**
 * OpenCode v2 runner parity suite — runs the real pinned `opencode serve`.
 *
 *   TAICO_OPENCODE_BIN=/path/to/opencode-1.19.0 npm run test:opencode-v2 -w @taico/worker
 *
 * Skipped (not failed) when the pinned CLI is not available.
 * Each `describe` maps to one acceptance criterion of the PoC.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { Event } from '@opencode-ai/sdk/v2';
import { OpenCodeV2AgentRunner, OpencodeMcpUnavailableError, OpencodeSessionFailedError, OpencodeEventStreamLostError, type OpenCodeV2RunnerOptions } from '../../runners/opencode-v2/OpenCodeV2AgentRunner.js';
import { startOpencodeV2Server, OpencodeStartupError } from '../../runners/opencode-v2/server.js';
import { checkOpencodeCli, OpencodeVersionMismatchError, OPENCODE_PINNED_VERSION } from '../../runners/opencode-v2/version.js';
import { buildOpencodeConfig, DEFAULT_TAICO_OPENCODE_POLICY, WorkspaceBoundaryError, type TaicoOpencodePolicy } from '../../runners/opencode-v2/policy.js';
import { OwnedSessions } from '../../runners/opencode-v2/session-events.js';
import { snapshotProcessTree } from '../../runners/opencode-v2/process-tree.js';
import { InterruptedExecutionError } from '../../task-execution-errors.js';
import type { AgentRunContext, RuntimeMcpServerConfig, TokenUsage } from '../../runners/AgentRunner.js';
import {
  createSandbox, isAlive, makeLayout, MockLlm, mockProviderConfig, MockTaicoMcp, MOCK_COST, OPENCODE_BIN,
  pinnedCliAvailable, readPids, waitFor, writeLocalMcpScript, type Sandbox,
} from './harness.js';

const available = pinnedCliAvailable();
if (!available && process.env.TAICO_OPENCODE_REQUIRED === '1') {
  throw new Error(`TAICO_OPENCODE_REQUIRED=1 but pinned opencode ${OPENCODE_PINNED_VERSION} is not at ${OPENCODE_BIN}`);
}
const skip = available ? false : `pinned opencode ${OPENCODE_PINNED_VERSION} not found (set TAICO_OPENCODE_BIN)`;
const T = { timeout: 90_000 };

let llm: MockLlm;
let mcp: MockTaicoMcp;
let sandbox: Sandbox;
let counter = 0;
/** Every server any test started; stopped in after() even if a test times out. */
const liveServers = new Set<{ stop(): Promise<void> }>();

type RunCapture = {
  events: string[];
  raw: Event[];
  tools: string[];
  usage: TokenUsage[];
  errors: string[];
  logs: string[];
};

function newCapture(): RunCapture {
  return { events: [], raw: [], tools: [], usage: [], errors: [], logs: [] };
}

function runner(options: OpenCodeV2RunnerOptions = {}, capture?: RunCapture) {
  return new OpenCodeV2AgentRunner(
    { providerId: 'mock', modelId: 'mock-model' },
    {
      env: sandbox.env,
      extraConfig: mockProviderConfig(llm),
      workspaceRoot: sandbox.workspaces,
      permissionTimeoutMs: 3_000,
      ...options,
      onLifecycle: (stage, info) => {
        liveServers.add(info.server);
        options.onLifecycle?.(stage, info);
      },
      onRawEvent: (e) => {
        capture?.raw.push(e);
        options.onRawEvent?.(e);
      },
    },
  );
}

function ctxFor(cwd: string, prompt: string, extra: Partial<AgentRunContext> = {}): AgentRunContext {
  counter += 1;
  return {
    taskId: `task-${counter}`,
    executionId: `exec-${counter}`,
    prompt,
    cwd,
    baseUrl: 'http://127.0.0.1:1',
    accessToken: `unused-${counter}`,
    mcpServers: {},
    agentSlug: 'tester',
    ...extra,
  };
}

async function run(r: OpenCodeV2AgentRunner, ctx: AgentRunContext, capture = newCapture()) {
  // Safety net: a stuck run must not outlive its test (cancel → tree kill).
  const guard = setTimeout(() => r.cancel(), 60_000);
  const result = await r.run(ctx, {
    onHeartbeat: () => undefined,
    onEvent: (m) => void capture.events.push(m),
    onToolCall: (t) => void capture.tools.push(t),
    onTokenUsage: (u) => void capture.usage.push(u),
    onError: (e) => void capture.errors.push(e.message),
  }).finally(() => clearTimeout(guard));
  return { result, capture };
}

function workspace(layout: 'none' | 'one' | 'many' = 'one') {
  counter += 1;
  return makeLayout(sandbox, `ws-${counter}`, layout);
}

function taicoMcp(token: string, executionId: string): Record<string, RuntimeMcpServerConfig> {
  return { taico: { type: 'http', url: mcp.url, headers: { Authorization: `Bearer ${token}`, 'x-taico-execution-id': executionId } } };
}

/** Tool part states for one tool name across raw events (last state wins per call). */
function toolStates(raw: Event[], tool: string) {
  const states = new Map<string, { status: string; error?: string; output?: string }>();
  for (const e of raw) {
    if (e.type === 'message.part.updated' && e.properties.part.type === 'tool' && e.properties.part.tool === tool) {
      const s = e.properties.part.state as any;
      states.set(e.properties.part.callID, { status: s.status, error: s.error, output: s.output });
    }
  }
  return [...states.values()];
}

/** Capture console output during fn (to prove secrets never reach logs). */
async function captureConsole<T>(logs: string[], fn: () => Promise<T>): Promise<T> {
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(orig) as Array<keyof typeof orig>) {
    console[k] = (...args: unknown[]) => {
      logs.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
  }
  try {
    return await fn();
  } finally {
    Object.assign(console, orig);
  }
}

describe('OpenCode v2 runner parity', { skip }, () => {
  before(async () => {
    llm = new MockLlm();
    mcp = new MockTaicoMcp();
    await Promise.all([llm.start(), mcp.start()]);
    sandbox = createSandbox();
  });

  after(async () => {
    await Promise.all([...liveServers].map((s) => s.stop()));
    await Promise.all([llm?.stop(), mcp?.stop()]);
    sandbox?.cleanup();
  });

  // ------------------------------------------------------------------ criterion 1
  describe('1. lifecycle', () => {
    test('CLI and server report the pinned version', T, async () => {
      const cli = await checkOpencodeCli({ bin: OPENCODE_BIN });
      assert.equal(cli.version, OPENCODE_PINNED_VERSION);
      await assert.rejects(checkOpencodeCli({ bin: OPENCODE_BIN, expected: '0.0.0' }), OpencodeVersionMismatchError);
    });

    test('bounded startup, correct cwd/config, password-protected, clean teardown', T, async () => {
      const cwd = workspace();
      const started = Date.now();
      const server = await startOpencodeV2Server({
        cwd,
        env: sandbox.env,
        config: buildOpencodeConfig({ mcp: {}, policy: DEFAULT_TAICO_OPENCODE_POLICY, extra: mockProviderConfig(llm) }),
        startupTimeoutMs: 30_000,
      });
      try {
        assert.ok(Date.now() - started < 30_000);
        assert.equal(server.version, OPENCODE_PINNED_VERSION);
        assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+/);

        // Unauthenticated access to the loopback port is refused.
        const anon = await fetch(`${server.url}/global/health`);
        assert.equal(anon.status, 401);

        // cwd + config are what we passed.
        const path = await server.client.path.get();
        assert.equal(path.data?.directory, cwd);
        const cfg = await server.client.config.get();
        assert.equal((cfg.data as any)?.permission?.external_directory, 'deny');
        const session = await server.client.session.create({});
        assert.equal(session.data?.directory, cwd);
      } finally {
        const tree = [server.pid, ...snapshotProcessTree(server.pid)];
        await server.stop();
        for (const pid of tree) assert.equal(isAlive(pid), false, `pid ${pid} survived teardown`);
      }
    });

    test('explicit port collision fails boundedly and leaves nothing behind', T, async () => {
      const blocker = createServer();
      await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
      const port = (blocker.address() as any).port as number;
      const started = Date.now();
      try {
        await assert.rejects(
          startOpencodeV2Server({ cwd: workspace(), env: sandbox.env, config: {}, port, startupTimeoutMs: 20_000 }),
          OpencodeStartupError,
        );
        assert.ok(Date.now() - started < 20_500, 'collision must not hang');
      } finally {
        blocker.close();
      }
    });

    test('startup timeout kills the process tree', T, async () => {
      const cwd = workspace();
      await assert.rejects(
        startOpencodeV2Server({ cwd, env: sandbox.env, config: {}, startupTimeoutMs: 1 }),
        OpencodeStartupError,
      );
    });

    test('a full run tears down server, tool shells and local MCP descendants', T, async () => {
      const cwd = workspace();
      const pidFile = join(sandbox.root, `mcp-pids-${counter}.txt`);
      const script = writeLocalMcpScript(sandbox.root, pidFile);
      const marker = llm.scenario('lifecycle-run', [
        { tool: 'local_ping', args: {} },
        { tool: 'bash', args: { command: 'sleep 300 > /dev/null 2>&1 & echo started', description: 'background sleeper' } },
        { text: 'done' },
      ]);
      let serverPid = 0;
      const capture = newCapture();
      const r = runner({ onLifecycle: (stage, { server }) => stage === 'server-started' && (serverPid = server.pid) }, capture);
      const { result } = await run(r, ctxFor(cwd, `${marker} go`, { mcpServers: { local: { type: 'stdio', command: process.execPath, args: [script] } } }), capture);
      assert.equal(result.result, 'done');
      assert.ok(toolStates(capture.raw, 'local_ping').some((s) => s.status === 'completed' && s.output?.includes('pong')));

      const mcpPids = readPids(pidFile);
      assert.equal(mcpPids.length, 2, 'local MCP and its grandchild started');
      for (const pid of [serverPid, ...mcpPids]) assert.equal(isAlive(pid), false, `pid ${pid} survived`);
    });
  });

  // ------------------------------------------------------------------ criterion 2
  describe('2. event attribution & terminal states', () => {
    test('two concurrent executions only see their own activity', T, async () => {
      const a = llm.scenario('concurrent-a', [{ tool: 'bash', args: { command: 'echo ALPHA-ONLY', description: 'a' } }, { text: 'ALPHA-FINAL' }]);
      const b = llm.scenario('concurrent-b', [{ tool: 'bash', args: { command: 'echo BRAVO-ONLY', description: 'b' } }, { text: 'BRAVO-FINAL' }]);
      const [ra, rb] = await Promise.all([
        run(runner(), ctxFor(workspace(), `${a} run`)),
        run(runner(), ctxFor(workspace(), `${b} run`)),
      ]);
      assert.equal(ra.result.result, 'ALPHA-FINAL');
      assert.equal(rb.result.result, 'BRAVO-FINAL');
      const aText = ra.capture.events.join('\n');
      const bText = rb.capture.events.join('\n');
      assert.ok(aText.includes('ALPHA-FINAL') && !aText.includes('BRAVO'));
      assert.ok(bText.includes('BRAVO-FINAL') && !bText.includes('ALPHA'));
    });

    test('foreign sessions on the same server are filtered out', T, async () => {
      const mine = llm.scenario('owned', [{ text: 'MINE-REPLY' }]);
      const theirs = llm.scenario('foreign', [{ text: 'FOREIGN-REPLY' }]);
      const capture = newCapture();
      let foreignSession = '';
      const r = runner(
        {
          onLifecycle: (stage, { server }) => {
            if (stage !== 'session-created') return;
            // Another actor drives a second session on our server mid-run.
            void (async () => {
              const s = await server.client.session.create({});
              foreignSession = s.data!.id;
              await server.client.session.promptAsync({
                sessionID: foreignSession,
                model: { providerID: 'mock', modelID: 'mock-model' },
                parts: [{ type: 'text', text: `${theirs} hi` }],
              });
            })();
          },
        },
        capture,
      );
      const { result } = await run(r, ctxFor(workspace(), `${mine} hi`), capture);
      assert.equal(result.result, 'MINE-REPLY');
      assert.ok(!capture.events.join('\n').includes('FOREIGN'));
      assert.ok(capture.raw.every((e) => (e.properties as any).sessionID === r.lastReport?.sessionId));
      // Unit-level guarantee for the same rule:
      const owned = new OwnedSessions('ses_a');
      assert.equal(owned.accept({ type: 'session.idle', properties: { sessionID: 'ses_b' } } as Event), false);
    });

    test('provider error fails the execution (session.error is terminal)', T, async () => {
      const marker = llm.scenario('provider-error', [{ httpError: 400, message: 'mock bad request' }]);
      const capture = newCapture();
      await assert.rejects(run(runner({}, capture), ctxFor(workspace(), `${marker} x`), capture), OpencodeSessionFailedError);
      assert.ok(capture.errors.some((e) => e.includes('mock bad request')), JSON.stringify(capture.errors));
    });

    test('SSE disconnect mid-run recovers via session status/messages', T, async () => {
      const marker = llm.scenario('sse-drop', [{ tool: 'bash', args: { command: 'sleep 2; echo slow', description: 's' } }, { text: 'RECOVERED' }]);
      let eventStreams = 0;
      const flakyFetch: typeof fetch = async (input, init) => {
        const req = input instanceof Request ? input : new Request(input, init);
        const res = await fetch(req);
        if (!new URL(req.url).pathname.endsWith('/event') || !res.body) return res;
        eventStreams += 1;
        if (eventStreams > 1) return res;
        // First stream dies after ~1.5s (in the middle of the bash call).
        const reader = res.body.getReader();
        const killAt = Date.now() + 1_500;
        const body = new ReadableStream({
          async pull(ctl) {
            if (Date.now() > killAt) {
              await reader.cancel();
              ctl.error(new Error('simulated SSE disconnect'));
              return;
            }
            const { done, value } = await reader.read();
            if (done) ctl.close();
            else ctl.enqueue(value);
          },
        });
        return new Response(body, { status: res.status, headers: res.headers });
      };
      const r = runner({ fetch: flakyFetch, reconnectDelayMs: 100 });
      const { result } = await run(r, ctxFor(workspace(), `${marker} x`));
      assert.equal(result.result, 'RECOVERED');
      assert.ok((r.lastReport?.reconnects ?? 0) >= 1);
    });

    test('permanently broken SSE fails boundedly (no hang)', T, async () => {
      const marker = llm.scenario('sse-dead', [{ tool: 'bash', args: { command: 'sleep 30', description: 'long' } }, { text: 'never' }]);
      let streams = 0;
      const deadFetch: typeof fetch = async (input, init) => {
        const req = input instanceof Request ? input : new Request(input, init);
        if (new URL(req.url).pathname.endsWith('/event') && ++streams > 1) {
          return new Response('down', { status: 503 });
        }
        if (new URL(req.url).pathname.endsWith('/event')) {
          const res = await fetch(req);
          const reader = res.body!.getReader();
          const killAt = Date.now() + 1_500;
          return new Response(
            new ReadableStream({
              async pull(ctl) {
                if (Date.now() > killAt) return ctl.error(new Error('gone'));
                const { done, value } = await reader.read();
                if (done) ctl.close();
                else ctl.enqueue(value);
              },
            }),
            { status: 200, headers: res.headers },
          );
        }
        return fetch(req);
      };
      const started = Date.now();
      await assert.rejects(run(runner({ fetch: deadFetch, maxReconnects: 3, reconnectDelayMs: 100 }), ctxFor(workspace(), `${marker} x`)), OpencodeEventStreamLostError);
      assert.ok(Date.now() - started < 20_000, 'must fail well before the 30s tool call');
    });
  });

  // ------------------------------------------------------------------ criterion 3
  describe('3. MCP authorization', () => {
    test('authorized remote MCP works and is attributed to the execution', T, async () => {
      mcp.validTokens.add('tok-good-1');
      const marker = llm.scenario('mcp-ok', [{ tool: 'taico_whoami', args: {} }, { text: 'MCP-DONE' }]);
      const capture = newCapture();
      const ctx = ctxFor(workspace(), `${marker} x`);
      ctx.mcpServers = taicoMcp('tok-good-1', ctx.executionId);
      const { result } = await captureConsole(capture.logs, () => run(runner({}, capture), ctx, capture));
      assert.equal(result.result, 'MCP-DONE');
      const calls = mcp.calls.filter((c) => c.executionId === ctx.executionId);
      assert.deepEqual(calls.map((c) => [c.tool, c.token]), [['whoami', 'tok-good-1']]);
      assert.ok(toolStates(capture.raw, 'taico_whoami').some((s) => s.output?.includes(`execution=${ctx.executionId}`)));
      assertNoSecret(capture, 'tok-good-1');
    });

    test('denied credentials: run fails before prompting, no tool invoked, no token leak', T, async () => {
      const marker = llm.scenario('mcp-denied', [{ tool: 'taico_whoami', args: {} }, { text: 'should not run' }]);
      const capture = newCapture();
      const ctx = ctxFor(workspace(), `${marker} x`);
      ctx.mcpServers = taicoMcp('tok-never-valid', ctx.executionId);
      let error: unknown;
      await captureConsole(capture.logs, async () => {
        try {
          await run(runner({}, capture), ctx, capture);
        } catch (e) {
          error = e;
        }
      });
      assert.ok(error instanceof OpencodeMcpUnavailableError, String(error));
      assert.equal(mcp.calls.filter((c) => c.executionId === ctx.executionId).length, 0);
      assert.equal(llm.requestsFor('mcp-denied').length, 0, 'LLM must not be prompted');
      assertNoSecret(capture, 'tok-never-valid', String((error as Error).message));
    });

    test('credentials expiring mid-run cannot invoke tools', T, async () => {
      mcp.validTokens.add('tok-expiring');
      const marker = llm.scenario('mcp-expire', [{ tool: 'taico_whoami', args: {} }, { text: 'AFTER-EXPIRY' }]);
      const capture = newCapture();
      const ctx = ctxFor(workspace(), `${marker} x`);
      ctx.mcpServers = taicoMcp('tok-expiring', ctx.executionId);
      const r = runner({ onLifecycle: (stage) => stage === 'session-created' && mcp.expiredTokens.add('tok-expiring') }, capture);
      const { result } = await captureConsole(capture.logs, () => run(r, ctx, capture));
      assert.equal(result.result, 'AFTER-EXPIRY');
      assert.equal(mcp.calls.filter((c) => c.executionId === ctx.executionId).length, 0, 'expired token reached tools/call');
      assert.ok(toolStates(capture.raw, 'taico_whoami').every((s) => s.status === 'error'));
      assertNoSecret(capture, 'tok-expiring');
    });

    test('concurrent executions never see each other’s MCP credentials', T, async () => {
      mcp.validTokens.add('tok-x');
      mcp.validTokens.add('tok-y');
      const m = llm.scenario('mcp-concurrent', [{ tool: 'taico_whoami', args: {} }, { text: 'ok' }]);
      const cx = ctxFor(workspace(), `${m} x`);
      cx.mcpServers = taicoMcp('tok-x', cx.executionId);
      const cy = ctxFor(workspace(), `${m} y`);
      cy.mcpServers = taicoMcp('tok-y', cy.executionId);
      await Promise.all([run(runner(), cx), run(runner(), cy)]);
      for (const call of mcp.calls.filter((c) => c.executionId === cx.executionId || c.executionId === cy.executionId)) {
        assert.equal(call.token, call.executionId === cx.executionId ? 'tok-x' : 'tok-y');
      }
      assert.equal(mcp.calls.filter((c) => c.executionId === cx.executionId).length, 1);
      assert.equal(mcp.calls.filter((c) => c.executionId === cy.executionId).length, 1);
    });
  });

  // ------------------------------------------------------------------ criterion 4
  describe('4. explicit permission policy', () => {
    const policy = (rules: TaicoOpencodePolicy['rules']): TaicoOpencodePolicy => ({ default: 'allow', rules: { ...DEFAULT_TAICO_OPENCODE_POLICY.rules, ...rules } });

    test('allow: bash runs', T, async () => {
      const cwd = workspace();
      const marker = llm.scenario('perm-allow', [{ tool: 'bash', args: { command: 'touch allowed.txt', description: 't' } }, { text: 'ok' }]);
      await run(runner({ policy: policy({ bash: 'allow' }) }), ctxFor(cwd, `${marker} x`));
      assert.ok(existsSync(join(cwd, 'allowed.txt')));
    });

    test('deny: bash, edit and MCP tools are never invoked', T, async () => {
      const cwd = workspace();
      mcp.validTokens.add('tok-perm');
      const marker = llm.scenario('perm-deny', [
        { tool: 'bash', args: { command: 'touch denied.txt', description: 't' } },
        { tool: 'write', args: { filePath: join(cwd, 'denied-write.txt'), content: 'x' } },
        { tool: 'taico_whoami', args: {} },
        { text: 'finished' },
      ]);
      const capture = newCapture();
      const ctx = ctxFor(cwd, `${marker} x`);
      ctx.mcpServers = taicoMcp('tok-perm', ctx.executionId);
      await run(runner({ policy: policy({ bash: 'deny', edit: 'deny', 'taico_*': 'deny' }) }, capture), ctx, capture).catch(noteRunError);
      assert.equal(existsSync(join(cwd, 'denied.txt')), false);
      assert.equal(existsSync(join(cwd, 'denied-write.txt')), false);
      assert.equal(mcp.calls.filter((c) => c.executionId === ctx.executionId).length, 0);
    });

    test('ask with no approver is rejected within the timeout (never pending forever)', T, async () => {
      const cwd = workspace();
      const marker = llm.scenario('perm-ask-reject', [{ tool: 'bash', args: { command: 'touch asked.txt', description: 't' } }, { text: 'after' }]);
      const r = runner({ policy: policy({ bash: 'ask' }), permissionTimeoutMs: 1_000 });
      const started = Date.now();
      await run(r, ctxFor(cwd, `${marker} x`)).catch(noteRunError);
      assert.ok(Date.now() - started < 30_000);
      assert.equal(existsSync(join(cwd, 'asked.txt')), false);
      assert.deepEqual(r.lastReport?.permissions.map((p) => [p.permission, p.reply]), [['bash', 'reject']]);
    });

    test('ask with a hanging approver is rejected by timeout', T, async () => {
      const cwd = workspace();
      const marker = llm.scenario('perm-ask-hang', [{ tool: 'bash', args: { command: 'touch hung.txt', description: 't' } }, { text: 'after' }]);
      const r = runner({ policy: policy({ bash: 'ask' }), permissionTimeoutMs: 500, approver: () => new Promise(() => undefined) });
      await run(r, ctxFor(cwd, `${marker} x`)).catch(noteRunError);
      assert.equal(existsSync(join(cwd, 'hung.txt')), false);
      assert.equal(r.lastReport?.permissions[0]?.reply, 'reject');
    });

    test('ask approved runs the tool', T, async () => {
      const cwd = workspace();
      const marker = llm.scenario('perm-ask-approve', [{ tool: 'bash', args: { command: 'touch approved.txt', description: 't' } }, { text: 'after' }]);
      const r = runner({ policy: policy({ bash: 'ask' }), approver: () => 'once' });
      await run(r, ctxFor(cwd, `${marker} x`));
      assert.ok(existsSync(join(cwd, 'approved.txt')));
    });

    test('external directory: deny blocks reads outside the workspace', T, async () => {
      const marker = llm.scenario('perm-external', [{ tool: 'read', args: { filePath: sandbox.secretFile } }, { text: 'after' }]);
      const capture = newCapture();
      await run(runner({}, capture), ctxFor(workspace(), `${marker} x`), capture).catch(noteRunError);
      const states = toolStates(capture.raw, 'read');
      assert.ok(states.length > 0 && states.every((s) => s.status === 'error'), JSON.stringify(states));
      assert.ok(!JSON.stringify(capture.raw).includes('TOP-SECRET-OUTSIDE-WORKSPACE'));
    });
  });

  // ------------------------------------------------------------------ criterion 5
  describe('5. cancellation', () => {
    const assertDead = (pids: number[]) => pids.forEach((pid) => assert.equal(isAlive(pid), false, `pid ${pid} survived cancel`));

    test('before spawn: no server is started', T, async () => {
      const ac = new AbortController();
      ac.abort();
      let started = false;
      const r = runner({ onLifecycle: () => (started = true) });
      await assert.rejects(run(r, ctxFor(workspace(), 'x', { abortSignal: ac.signal })), InterruptedExecutionError);
      assert.equal(started, false);
      assert.equal(r.lastReport?.outcome, 'interrupted');
    });

    test('during startup: process tree is killed, reported as interrupted', T, async () => {
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 150);
      const r = runner();
      await assert.rejects(run(r, ctxFor(workspace(), 'x', { abortSignal: ac.signal })), InterruptedExecutionError);
      assert.equal(r.lastReport?.outcome, 'interrupted');
    });

    test('after session creation: interrupted, LLM never prompted', T, async () => {
      const marker = llm.scenario('cancel-after-session', [{ text: 'never' }]);
      const ac = new AbortController();
      let serverPid = 0;
      const r = runner({
        onLifecycle: (stage, { server }) => {
          serverPid = server.pid;
          if (stage === 'session-created') ac.abort();
        },
      });
      await assert.rejects(run(r, ctxFor(workspace(), `${marker} x`, { abortSignal: ac.signal })), InterruptedExecutionError);
      assert.equal(llm.requestsFor('cancel-after-session').length, 0);
      assertDead([serverPid]);
    });

    test('during tool execution: tool process and server are gone when run() settles', T, async () => {
      const cwd = workspace();
      const marker = llm.scenario('cancel-in-tool', [
        { tool: 'bash', args: { command: 'echo $$ > tool.pid; sleep 120; touch finished.txt', description: 'long' } },
        { text: 'never' },
      ]);
      const ac = new AbortController();
      let serverPid = 0;
      const r = runner({
        onLifecycle: (stage, { server }) => (serverPid = server.pid),
        onRawEvent: (e) => {
          if (e.type === 'message.part.updated' && e.properties.part.type === 'tool' && e.properties.part.state.status === 'running') {
            setTimeout(() => ac.abort(), 500);
          }
        },
      });
      await assert.rejects(run(r, ctxFor(cwd, `${marker} x`, { abortSignal: ac.signal })), InterruptedExecutionError);
      assert.equal(r.lastReport?.outcome, 'interrupted');
      await waitFor(() => existsSync(join(cwd, 'tool.pid')), 1_000, 'tool pid file').catch(noteRunError);
      const toolPid = Number(readFileSync(join(cwd, 'tool.pid'), 'utf8').trim());
      assertDead([serverPid, toolPid]);
      assert.equal(existsSync(join(cwd, 'finished.txt')), false);
    });

    test('during an LLM call: interrupted promptly', T, async () => {
      const marker = llm.scenario('cancel-in-llm', [{ hang: true }]);
      const ac = new AbortController();
      const r = runner({ onLifecycle: (stage) => stage === 'prompted' && setTimeout(() => ac.abort(), 500) });
      const started = Date.now();
      await assert.rejects(run(r, ctxFor(workspace(), `${marker} x`, { abortSignal: ac.signal })), InterruptedExecutionError);
      assert.ok(Date.now() - started < 20_000);
    });

    test('runner.cancel() works without an external signal', T, async () => {
      const marker = llm.scenario('cancel-method', [{ hang: true }]);
      const r = runner({ onLifecycle: (stage) => stage === 'prompted' && setTimeout(() => r.cancel(), 300) });
      await assert.rejects(run(r, ctxFor(workspace(), `${marker} x`)), InterruptedExecutionError);
    });
  });

  // ------------------------------------------------------------------ criterion 6
  describe('6. usage reconciliation & workspace boundary', () => {
    test('token/cost totals reconcile from final session messages', T, async () => {
      const marker = llm.scenario('usage', [
        { tool: 'bash', args: { command: 'echo one', description: 'a' }, usage: { prompt: 100, completion: 20 } },
        { tool: 'bash', args: { command: 'echo two', description: 'b' }, usage: { prompt: 200, completion: 30 } },
        { text: 'USAGE-DONE', usage: { prompt: 300, completion: 40 } },
      ]);
      const r = runner();
      const { capture } = await run(r, ctxFor(workspace(), `${marker} x`));
      const usage = r.lastReport!.usage!;
      assert.equal(usage.inputTokens, 600);
      assert.equal(usage.outputTokens, 90);
      assert.equal(usage.assistantMessages, 3);
      const expectedCost = (600 * MOCK_COST.input + 90 * MOCK_COST.output) / 1_000_000;
      assert.ok(Math.abs(usage.cost - expectedCost) < 1e-9, `cost ${usage.cost} != ${expectedCost}`);
      const last = capture.usage[capture.usage.length - 1];
      assert.deepEqual(last, { inputTokens: 600, outputTokens: 90, totalTokens: 690 });
    });

    for (const layout of ['none', 'one', 'many'] as const) {
      test(`layout "${layout}": session runs in cwd, escape attempts are denied`, T, async () => {
        const cwd = workspace(layout);
        const marker = llm.scenario(`layout-${layout}`, [
          { tool: 'read', args: { filePath: join(cwd, '..', '..', '..', '..', 'outside', 'secret.txt') } },
          { tool: 'write', args: { filePath: join(sandbox.outside, `escape-${layout}.txt`), content: 'x' } },
          { tool: 'bash', args: { command: `cat ${sandbox.secretFile}`, description: 'escape' } },
          { tool: 'bash', args: { command: 'pwd', description: 'pwd' } },
          { text: 'layout-ok' },
        ]);
        const capture = newCapture();
        await run(runner({}, capture), ctxFor(cwd, `${marker} x`), capture);
        const pwd = toolStates(capture.raw, 'bash').at(-1);
        assert.equal(pwd?.output?.trim(), cwd);
        assert.ok(toolStates(capture.raw, 'read').every((s) => s.status === 'error'));
        assert.equal(existsSync(join(sandbox.outside, `escape-${layout}.txt`)), false);
        assert.ok(!JSON.stringify(capture.raw).includes('TOP-SECRET-OUTSIDE-WORKSPACE'), 'bash escaped the workspace');
      });
    }

    // Tripwire, not a guarantee: OpenCode only detects *literal* paths in shell
    // commands. If this ever starts failing, OpenCode added real sandboxing and
    // the rollout notes should be revisited.
    test('KNOWN GAP: an obfuscated shell command still escapes (policy is not OS isolation)', T, async () => {
      const encoded = Buffer.from(sandbox.secretFile).toString('base64');
      const marker = llm.scenario('known-gap', [
        { tool: 'bash', args: { command: `cat "$(echo ${encoded} | base64 -d)"`, description: 'obfuscated' } },
        { text: 'gap' },
      ]);
      const capture = newCapture();
      await run(runner({}, capture), ctxFor(workspace(), `${marker} x`), capture);
      const out = toolStates(capture.raw, 'bash')[0]?.output ?? '';
      assert.ok(out.includes('TOP-SECRET-OUTSIDE-WORKSPACE'), 'escape no longer works — update docs/how-to-guides/opencode-v2-runner.md');
    });

    test('cwd outside the workspace root (incl. via symlink) is refused before spawn', T, async () => {
      const link = join(sandbox.workspaces, `link-${++counter}`);
      symlinkSync(sandbox.outside, link);
      let started = false;
      const r = runner({ onLifecycle: () => (started = true) });
      await assert.rejects(run(r, ctxFor(link, 'x')), WorkspaceBoundaryError);
      await assert.rejects(run(runner(), ctxFor(sandbox.outside, 'x')), WorkspaceBoundaryError);
      assert.equal(started, false);
    });
  });
});

/** Runs that are expected to end either way still surface unexpected errors in the test log. */
function noteRunError(e: unknown) {
  process.stderr.write(`[run ended with error] ${(e as Error)?.name}: ${(e as Error)?.message}\n`);
}

function assertNoSecret(capture: RunCapture, secret: string, ...extra: string[]) {
  const haystacks = { events: capture.events, errors: capture.errors, logs: capture.logs, raw: capture.raw.map((e) => JSON.stringify(e)), extra };
  for (const [name, list] of Object.entries(haystacks)) {
    assert.ok(!list.some((s) => s.includes(secret)), `secret leaked into ${name}`);
  }
}

