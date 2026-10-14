/**
 * Test harness for the OpenCode v2 runner parity suite.
 *
 * Runs the REAL pinned `opencode serve` binary against:
 * - a scripted OpenAI-compatible mock LLM (deterministic tool calls, errors, usage),
 * - a mock remote "Taico" MCP server that checks bearer + execution id,
 * - a local stdio MCP server that spawns a long-lived grandchild,
 * with HOME/XDG dirs isolated so the developer's own OpenCode config/auth is never touched.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '@opencode-ai/sdk/v2';
import { OPENCODE_PINNED_VERSION, resolveOpencodeBin } from '../../runners/opencode-v2/version.js';

export const OPENCODE_BIN = resolveOpencodeBin();

export function pinnedCliAvailable(): boolean {
  try {
    return execFileSync(OPENCODE_BIN, ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim() === OPENCODE_PINNED_VERSION;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- mock LLM

export type Usage = { prompt: number; completion: number };
export type Step =
  | { text: string; usage?: Usage; delayMs?: number }
  | { tool: string; args: Record<string, unknown>; usage?: Usage; delayMs?: number }
  | { httpError: number; message: string }
  | { hang: true };

export type LlmRequestLog = { scenario: string | null; toolResults: number; body: any };

export class MockLlm {
  private server!: http.Server;
  private readonly scenarios = new Map<string, Step[]>();
  readonly requests: LlmRequestLog[] = [];
  private readonly hanging = new Set<http.ServerResponse>();
  url = '';

  scenario(name: string, steps: Step[]) {
    this.scenarios.set(name, steps);
    return `[[scenario:${name}]]`;
  }

  /** Requests that belong to a scenario (title-generation side calls excluded). */
  requestsFor(name: string) {
    return this.requests.filter((r) => r.scenario === name && r.body.tools);
  }

  async start() {
    this.server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => void this.handle(req, res, raw));
    });
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/v1`;
  }

  async stop() {
    for (const res of this.hanging) res.destroy();
    this.server.closeAllConnections();
    await new Promise((r) => this.server.close(r));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse, raw: string) {
    if (!req.url?.includes('chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.parse(raw);
    const text = JSON.stringify(body.messages ?? []);
    const scenario = text.match(/\[\[scenario:([\w-]+)\]\]/)?.[1] ?? null;
    const toolResults = (body.messages ?? []).filter((m: any) => m.role === 'tool').length;
    this.requests.push({ scenario, toolResults, body });

    // Side calls (title generation etc.) carry no tools: answer trivially, no usage.
    const steps = scenario ? this.scenarios.get(scenario) : undefined;
    if (!body.tools || !steps) {
      return this.stream(res, [{ delta: { role: 'assistant', content: 'Title' } }], 'stop', { prompt: 0, completion: 0 });
    }

    const step = steps[Math.min(toolResults, steps.length - 1)];
    if ('hang' in step) {
      this.hanging.add(res);
      res.on('close', () => this.hanging.delete(res));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      return; // never answers; only cancellation ends this
    }
    if ('httpError' in step) {
      res.writeHead(step.httpError, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: step.message, type: 'invalid_request_error', code: 'mock_error' } }));
      return;
    }
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    const usage = step.usage ?? { prompt: 10, completion: 5 };
    if ('tool' in step) {
      return this.stream(
        res,
        [
          {
            delta: {
              role: 'assistant',
              tool_calls: [
                { index: 0, id: `call_${toolResults}_${Date.now()}`, type: 'function', function: { name: step.tool, arguments: JSON.stringify(step.args) } },
              ],
            },
          },
        ],
        'tool_calls',
        usage,
      );
    }
    return this.stream(res, [{ delta: { role: 'assistant', content: step.text } }], 'stop', usage);
  }

  private stream(res: http.ServerResponse, deltas: Array<{ delta: unknown }>, finish: string, usage: Usage) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const base = { id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1, model: 'mock-model' };
    for (const d of deltas) res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, ...d }] })}\n\n`);
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: {}, finish_reason: finish }],
        usage: { prompt_tokens: usage.prompt, completion_tokens: usage.completion, total_tokens: usage.prompt + usage.completion },
      })}\n\n`,
    );
    res.end('data: [DONE]\n\n');
  }
}

/** $ per 1M tokens used by the mock model, so cost reconciliation is checkable. */
export const MOCK_COST = { input: 2, output: 8 };

export function mockProviderConfig(llm: MockLlm): Config {
  return {
    model: 'mock/mock-model',
    small_model: 'mock/mock-model',
    provider: {
      mock: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Mock',
        options: { baseURL: llm.url, apiKey: 'mock-key' },
        models: {
          'mock-model': { name: 'mock-model', tool_call: true, cost: MOCK_COST, limit: { context: 100_000, output: 4_000 } },
        },
      },
    },
  } as Config;
}

// ---------------------------------------------------------------- mock remote MCP

export type McpCall = { tool: string; token: string | null; executionId: string | null; args: unknown };

/** Minimal streamable-HTTP MCP server (JSON responses) standing in for Taico's MCP endpoint. */
export class MockTaicoMcp {
  private server!: http.Server;
  readonly validTokens = new Set<string>();
  readonly expiredTokens = new Set<string>();
  readonly calls: McpCall[] = [];
  readonly rejected: Array<{ method: string; token: string | null }> = [];
  url = '';

  async start() {
    this.server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => this.handle(req, res, raw));
    });
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/mcp`;
  }

  async stop() {
    this.server.closeAllConnections();
    await new Promise((r) => this.server.close(r));
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse, raw: string) {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '') || null;
    const executionId = (req.headers['x-taico-execution-id'] as string) ?? null;
    const msg = JSON.parse(raw || '{}');
    const authorized = token !== null && this.validTokens.has(token) && !this.expiredTokens.has(token);
    if (!authorized) {
      this.rejected.push({ method: msg.method, token });
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer error="invalid_token"' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (msg.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    const reply = (result: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    };
    switch (msg.method) {
      case 'initialize':
        return reply({
          protocolVersion: msg.params?.protocolVersion ?? '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'mock-taico', version: '1.0.0' },
        });
      case 'tools/list':
        return reply({
          tools: [
            { name: 'whoami', description: 'Returns the Taico execution id', inputSchema: { type: 'object', properties: {} } },
          ],
        });
      case 'tools/call':
        this.calls.push({ tool: msg.params.name, token, executionId, args: msg.params.arguments });
        return reply({ content: [{ type: 'text', text: `execution=${executionId}` }] });
      default:
        return reply({});
    }
  }
}

// ---------------------------------------------------------------- local stdio MCP

/**
 * Writes a stdio MCP server script that spawns a long-lived `sleep` grandchild
 * (to prove teardown reaps MCP descendants) and records its pids in `pidFile`.
 */
export function writeLocalMcpScript(dir: string, pidFile: string): string {
  const path = join(dir, 'local-mcp.mjs');
  writeFileSync(
    path,
    `
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import readline from 'node:readline';
const sleeper = spawn('sleep', ['600'], { stdio: 'ignore' });
appendFileSync(${JSON.stringify(pidFile)}, process.pid + '\\n' + sleeper.pid + '\\n');
const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.id === undefined) return;
  if (msg.method === 'initialize') return send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'local', version: '1' } } });
  if (msg.method === 'tools/list') return send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'ping', description: 'ping', inputSchema: { type: 'object', properties: {} } }] } });
  if (msg.method === 'tools/call') return send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'pong from local mcp' }] } });
  send({ jsonrpc: '2.0', id: msg.id, result: {} });
});
`,
  );
  return path;
}

export function readPids(file: string): number[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(Number);
}

// ---------------------------------------------------------------- workspace / env

export type Sandbox = {
  root: string;
  workspaces: string;
  outside: string;
  secretFile: string;
  env: NodeJS.ProcessEnv;
  cleanup(): void;
};

/** Temp tree: isolated OpenCode home, a workspace root, and a file OUTSIDE it. */
export function createSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'taico-oc2-'));
  const home = join(root, 'home');
  const workspaces = join(root, 'workspaces');
  const outside = join(root, 'outside');
  for (const d of [home, workspaces, outside]) mkdirSync(d, { recursive: true });
  const secretFile = join(outside, 'secret.txt');
  writeFileSync(secretFile, 'TOP-SECRET-OUTSIDE-WORKSPACE\n');
  return {
    root,
    workspaces,
    outside,
    secretFile,
    env: {
      HOME: home,
      XDG_CONFIG_HOME: join(home, '.config'),
      XDG_DATA_HOME: join(home, '.local/share'),
      XDG_CACHE_HOME: join(home, '.cache'),
      XDG_STATE_HOME: join(home, '.local/state'),
      OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
      OPENCODE_DISABLE_CLAUDE_CODE: '1',
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Builds the three layouts prepareWorkspace produces and returns the agent cwd. */
export function makeLayout(sandbox: Sandbox, name: string, layout: 'none' | 'one' | 'many'): string {
  const base = join(sandbox.workspaces, name, 'agent');
  mkdirSync(base, { recursive: true });
  const initRepo = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
    execFileSync('git', ['init', '-q'], { cwd: dir });
  };
  if (layout === 'none') return base;
  if (layout === 'one') {
    initRepo(join(base, 'repo'));
    return join(base, 'repo');
  }
  initRepo(join(base, 'repos', 'alpha'));
  initRepo(join(base, 'repos', 'beta'));
  return join(base, 'repos');
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function waitFor(cond: () => boolean, timeoutMs: number, label: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/** All live pids whose command line mentions `needle` (used to find orphans). */
export function pidsMatching(needle: string): number[] {
  const out = execFileSync('ps', ['-A', '-o', 'pid=,args='], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes(needle))
    .map((l) => Number(l.split(/\s+/)[0]))
    .filter((p) => p !== process.pid);
}
