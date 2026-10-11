// Live test of the threads agent across processes. Run after a build:
//   npm run build && npm run test:live:threads
//
// Starts two backend processes on one throwaway database plus a fake
// OpenAI-compatible model server, then checks that:
//   1. a turn running on process A streams to a socket client on process B,
//      including a real MCP tool call
//   2. messages sent to both processes at once are queued, never run in parallel
//   3. switching provider and model mid-thread replays the stored history
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(process.cwd() + '/package.json');
const { Client } = require('pg');
const { io } = require('socket.io-client');

const PORT_A = 39501, PORT_B = 39502, PORT_LLM = 39503;
const A = `http://127.0.0.1:${PORT_A}`, B = `http://127.0.0.1:${PORT_B}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[live]', ...a);

// ---- fake LLM -----------------------------------------------------------
const llmRequests = [];
const llm = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const json = JSON.parse(body || '{}');
    llmRequests.push(json);
    if (!json.stream) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: 'x', object: 'chat.completion', created: 1, model: json.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'Live Test Title' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (delta, finish = null) => res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 1, model: json.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
    const lastUser = [...json.messages].reverse().find((m) => m.role === 'user');
    const lastUserText = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content);
    const last = json.messages[json.messages.length - 1];
    const wantsTool = /use the tool/.test(lastUserText) && last.role !== 'tool';
    if (wantsTool) {
      const threadId = /inside thread ([0-9a-f-]{36})/.exec(json.messages[0].content)[1];
      send({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'tasks__list_tasks_by_thread', arguments: JSON.stringify({ threadId }) } }] });
      send({}, 'tool_calls');
    } else {
      await sleep(/slow/.test(lastUserText) ? 800 : 0);
      for (const piece of ['Reply ', 'from ', json.model, '.']) { send({ role: 'assistant', content: piece }); await sleep(30); }
      send({}, 'stop');
    }
    res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 1, model: json.model, choices: [], usage: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 } })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});
await new Promise((r) => llm.listen(PORT_LLM, '127.0.0.1', r));

// ---- database + backends ------------------------------------------------
const adminUrl = new URL(
  process.env.POSTGRES_ADMIN_URL ?? 'postgresql://taico:taico@127.0.0.1:5432/postgres',
);
const dbName = `taico_test_live_${process.pid}`;
const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${dbName}"`);
const dbUrl = new URL(adminUrl); dbUrl.pathname = `/${dbName}`;
const db = new Client({ connectionString: dbUrl.toString() });

const procs = [];
const startBackend = (port) => {
  const p = spawn(process.execPath, ['dist/main.js', '--server'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: dbUrl.toString(), TYPEORM_SCHEMA_MODE: 'migrate',
      ISSUER_URL: A, BACKEND_PORT: String(port), THREAD_STATE_RECONCILER_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  p.getOutput = () => out;
  procs.push(p);
  return p;
};
const waitUp = async (base, proc) => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${base}/api/v1/chat-providers`); if (r.status < 500) return; } catch {}
    if (proc.exitCode !== null) throw new Error(`backend exited:\n${proc.getOutput().slice(-3000)}`);
    await sleep(500);
  }
  throw new Error(`backend at ${base} did not start:\n${proc.getOutput().slice(-3000)}`);
};

let failed = false;
try {
  const pa = startBackend(PORT_A); await waitUp(A, pa); log('backend A up');
  const pb = startBackend(PORT_B); await waitUp(B, pb); log('backend B up');
  await db.connect();

  const login = await fetch(`${A}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.com', password: 'admin' }) });
  assert.ok(login.ok, `login failed ${login.status}`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = async (base, method, path, body) => {
    const r = await fetch(`${base}/api/v1${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    assert.ok(r.ok, `${method} ${path} -> ${r.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };

  // provider through the real factory (OpenAI-compatible -> fake server)
  const p1 = await call(A, 'POST', '/chat-providers', { name: 'Fake 1', type: 'openai_compatible', baseUrl: `http://127.0.0.1:${PORT_LLM}/v1`, modelId: 'fake-model-1' });
  await call(A, 'POST', '/chat-providers/set-active', { providerId: p1.id });
  const thread = await call(A, 'POST', '/threads', { title: 'Live thread' });
  log('thread', thread.id);

  // socket client on B, messages posted to A
  const events = [];
  const socket = io(`${B}/threads`, { transports: ['websocket'], extraHeaders: { cookie } });
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
  const ack = await socket.emitWithAck('threads.subscribe', { threadId: thread.id });
  assert.ok(ack.ok, 'subscribe failed');
  socket.onAny((name, payload) => events.push({ name, payload }));

  const agentMessages = async () => (await db.query(
    `SELECT tm.content, tm.agent_message_id FROM thread_messages tm JOIN actors a ON a.id = tm.created_by_actor_id
      WHERE tm.thread_id = $1 AND a.slug = 'taico' ORDER BY tm.created_at`, [thread.id])).rows;
  const waitReplies = async (n) => {
    for (let i = 0; i < 200; i++) {
      const rows = await agentMessages();
      const running = (await db.query(`SELECT 1 FROM thread_turns WHERE thread_id = $1 AND status = 'running'`, [thread.id])).rowCount;
      if (rows.length >= n && running === 0) return rows;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${n} replies; have ${JSON.stringify(await agentMessages())}\nA:\n${pa.getOutput().slice(-2500)}`);
  };

  // 1. tool call over real MCP + cross-process streaming
  await call(A, 'POST', `/threads/${thread.id}/messages`, { content: 'please use the tool' });
  const first = await waitReplies(1);
  assert.equal(first[0].content, 'Reply from fake-model-1.');
  const logRows = (await db.query(`SELECT role, source, provider_type, model_id, message FROM thread_agent_messages WHERE thread_id = $1 ORDER BY created_at, role`, [thread.id])).rows;
  assert.deepEqual(logRows.map((r) => r.role).sort(), ['assistant', 'assistant', 'tool', 'user']);
  const toolRow = logRows.find((r) => r.role === 'tool');
  assert.ok(!JSON.stringify(toolRow.message).includes('"isError":true'), 'MCP tool call errored: ' + JSON.stringify(toolRow.message));
  log('tool result stored:', JSON.stringify(toolRow.message).slice(0, 160));
  await sleep(300);
  const deltas = events.filter((e) => e.name === 'thread.agent.response.delta');
  const created = events.filter((e) => e.name === 'thread.message.created');
  assert.ok(deltas.length >= 3, `client on B got ${deltas.length} deltas from a turn that ran on A`);
  assert.equal(deltas.map((d) => d.payload.payload.delta).join(''), 'Reply from fake-model-1.');
  assert.ok(created.some((e) => e.payload.payload.content === 'Reply from fake-model-1.'), 'client on B did not get the agent message');
  assert.ok(events.some((e) => e.name === 'thread.agent.activity'), 'no activity event on B');
  log(`cross-process streaming OK (${deltas.length} deltas, ${created.length} message events on B)`);

  // 2. messages hitting both processes at once: queued, never two turns at once
  await Promise.all([
    call(A, 'POST', `/threads/${thread.id}/messages`, { content: 'slow one' }),
    call(B, 'POST', `/threads/${thread.id}/messages`, { content: 'slow two' }),
    sleep(150).then(() => call(B, 'POST', `/threads/${thread.id}/messages`, { content: 'slow three' })),
  ]);
  await waitReplies(2);
  await sleep(1500); await waitReplies(2);
  const unseen = (await db.query(`SELECT count(*)::int AS c FROM thread_messages WHERE thread_id = $1 AND agent_message_id IS NULL`, [thread.id])).rows[0].c;
  assert.equal(unseen, 0, 'some messages were never seen by the agent');
  const turns = (await db.query(`SELECT status, started_at, finished_at FROM thread_turns WHERE thread_id = $1 ORDER BY started_at`, [thread.id])).rows;
  assert.ok(turns.every((t) => t.status === 'completed'), JSON.stringify(turns));
  for (let i = 1; i < turns.length; i++) assert.ok(turns[i].started_at >= turns[i - 1].finished_at, 'turns overlapped');
  log(`queueing OK (${turns.length} turns, no overlap, nothing unseen)`);

  // 3. switch provider + model mid-thread; history is replayed to the new model
  const p2 = await call(B, 'POST', '/chat-providers', { name: 'Fake 2', type: 'openai_compatible', baseUrl: `http://127.0.0.1:${PORT_LLM}/v1`, modelId: 'fake-model-2' });
  await call(B, 'POST', '/chat-providers/set-active', { providerId: p2.id });
  const before = (await agentMessages()).length;
  await call(B, 'POST', `/threads/${thread.id}/messages`, { content: 'and now?' });
  const after = await waitReplies(before + 1);
  assert.equal(after.at(-1).content, 'Reply from fake-model-2.');
  const lastReq = llmRequests.filter((r) => r.stream).at(-1);
  assert.equal(lastReq.model, 'fake-model-2');
  const replay = JSON.stringify(lastReq.messages);
  assert.ok(replay.includes('please use the tool') && replay.includes('tasks__list_tasks_by_thread') && replay.includes('Reply from fake-model-1.'), 'history was not replayed to the new model');
  assert.ok(lastReq.messages.some((m) => m.role === 'tool'), 'tool result missing from replay');
  log(`model switch OK (${lastReq.messages.length} messages replayed to fake-model-2)`);

  socket.close();
  log('ALL LIVE CHECKS PASSED');
} catch (error) {
  failed = true;
  console.error('[live] FAILED:', error);
} finally {
  for (const p of procs) p.kill('SIGTERM');
  await sleep(1500);
  await db.end().catch(() => {});
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [dbName]);
  await admin.query(`DROP DATABASE "${dbName}"`);
  await admin.end();
  llm.close();
  process.exit(failed ? 1 : 0);
}
