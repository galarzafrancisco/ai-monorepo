# Codex App Server runner exploration

## Bottom line

Codex App Server is a real candidate for a Taico `CodexRunner`, but it is not a drop-in replacement for the current `OpenCodeAgentRunner`.

It looks stronger for rich product integration: threads, resumable turns, event streams, approvals, model discovery, MCP status, config reads/writes, skills/plugins, filesystem APIs, and explicit cancellation are all first-class protocol pieces. That maps better to Taico than driving a generic local HTTP server and hoping its events line up.

The catch: OpenAI's own docs say App Server is for rich clients, while automation/CI should use the Codex SDK. Taico worker execution is closer to automation than a human IDE client. So the right move is probably a small spike, not a blind migration.

## What Taico does today with OpenCode

Current runner: `apps/worker/src/runners/OpenCodeAgentRunner.ts`.

Behavior today:

- Spawns `opencode serve --hostname=127.0.0.1 --port=<4000-4099>`.
- Injects MCP config through `OPENCODE_CONFIG_CONTENT`.
- Uses `@opencode-ai/sdk` to create a session in the task workspace.
- Uses a global `process.chdir` lock because OpenCode session directory handling broke realtime events when passed normally.
- Subscribes to OpenCode SSE events and formats them into Taico activity messages.
- Tracks tool calls from `message.part.updated` tool parts.
- Extracts token usage from OpenCode event token metadata.
- Cancels by calling `client.session.abort`, then killing the managed server process.
- Defaults to provider `openai`, model `gpt-5.4` unless agent config overrides it.

That runner is already paying tax around process lifecycle, port selection, realtime event quirks, and cwd handling.

## What Codex App Server gives us

From the App Server docs:

- JSON-RPC 2.0 style protocol, with the `jsonrpc` field omitted on the wire.
- Transports: stdio by default, experimental websocket, or off.
- Required handshake: `initialize`, then `initialized` before anything else.
- Conversation model: `Thread`, `Turn`, `Item`.
- Main path: `thread/start` or `thread/resume`, then `turn/start`, then consume notifications until `turn/completed`.
- Cancellation: `turn/interrupt`.
- Model discovery: `model/list` includes model id, display name, reasoning efforts, modalities, defaults, hidden state, and personality support.
- Thread history: `thread/list`, `thread/read`, `thread/turns/list`, `thread/resume`, `thread/fork`, rollback, archive/unarchive.
- Events include `item/started`, `item/completed`, `item/agentMessage/delta`, command/tool progress, `turn/completed`, and more.
- MCP is native enough to expose config reload, status listing, OAuth login, resource reads, and tool calls.
- Schema generation exists: `codex app-server generate-ts --out ./schemas` and JSON Schema generation too.
- WebSocket mode has auth options, health probes, overload errors, and warning labels. It is still experimental and unsupported.

For Taico, stdio is probably the right first transport. It avoids port hunting, listener auth, and unsupported websocket semantics.

## Could we build a compatible `CodexRunner`?

Yes, likely.

A minimal `CodexRunner` can fit the current `BaseAgentRunner` contract:

- Spawn `codex app-server` with stdio.
- Send `initialize` with a Taico-specific `clientInfo.name`, title, and worker version.
- Send `initialized`.
- Send `thread/start` with `model`, `cwd`, `approvalPolicy`, `sandbox`, and maybe `serviceName`.
- Persist returned `thread.id` through `setSession`.
- Send `turn/start` with the built Taico prompt.
- Read notifications until `turn/completed`.
- Convert agent message deltas/completions into Taico activity events.
- Convert command/tool item lifecycle events into tool-call callbacks and useful activity messages.
- On cancellation, send `turn/interrupt`, then kill the child process if it does not finish.

Compatibility gaps to solve:

- Event formatter: OpenCode formatter cannot be reused. Codex event names and item shapes are different.
- Final result: need to decide whether `result` returns the final assistant text, concatenated `item/agentMessage/delta`, or a completed agent message item.
- Token usage: `codex exec --json` emits usage on `turn.completed`; App Server docs show turn events but do not clearly document usage payload in the visible docs. Needs schema generation or source inspection.
- MCP config injection: current OpenCode path injects MCP config via env. Codex uses config files plus app-server methods like `config/mcpServer/reload` and MCP status/tool APIs. Need verify the exact config shape and whether runtime-only MCP config can be provided cleanly per run.
- Allowed tools: Taico computes `allowedTools`; Codex has sandbox/approval policy knobs, but mapping Taico's per-agent MCP permissions and tool allowlist needs explicit design.
- Approvals/input: App Server has approvals and `tool/requestUserInput`; Taico already has task input request plumbing. Good fit, but not zero work.
- Auth is the biggest product decision.

## App Server versus Codex SDK

Docs explicitly say: if you are automating jobs or running Codex in CI, use the Codex SDK instead.

That matters because Taico worker runs are headless task executions. The SDK may be the better runner API if we only need `thread.run(prompt)` plus events. The TypeScript SDK is installable as `@openai/codex-sdk`, runs server-side on Node 18+, and supports starting/resuming threads. The Python SDK is experimental and controls App Server directly.

My read:

- Use App Server if Taico wants deep Codex-client features exposed in product: thread browsing, turn history, approvals, MCP OAuth/status, model picker, skills/plugins/config surfaces.
- Use TypeScript SDK if Taico wants a worker harness that runs a prompt and streams enough events without owning the JSON-RPC protocol.
- Use `codex exec --json` only as the roughest prototype. It gives event JSONL, final output handling, easy API-key auth in CI, and less code, but it is weaker for cancellation, session mapping, and rich UI integration.

## Authentication reality

Codex supports two auth paths for OpenAI models:

- ChatGPT login/subscription/workspace auth.
- API key auth.

CLI/IDE share cached credentials at `~/.codex/auth.json` or OS credential store. ChatGPT auth refreshes tokens during use. API-key usage follows Platform billing/data settings. ChatGPT usage follows ChatGPT workspace controls, RBAC, retention, and residency.

For automation, docs recommend API key auth. `CODEX_API_KEY` is specifically documented for `codex exec`, not necessarily for app-server. For normal CLI/app-server flows, `codex login --api-key` or cached auth is the safe assumption.

Using Codex's authentication from inside Taico has three possible shapes:

- Worker-level service credential: provision `CODEX_API_KEY` or seed Codex CLI auth on worker hosts. This is simplest operationally, but every Codex run uses one shared OpenAI identity unless we shard workers/secrets by project/customer.
- Per-agent/per-project API key: store an encrypted credential in Taico and materialize it for the worker run. This maps better to Taico access control and billing boundaries, but it requires secret storage UX and careful environment/config isolation.
- ChatGPT account auth: technically possible by seeding/maintaining `~/.codex/auth.json`, including headless device-code or copied auth cache flows. This is awkward for Taico SaaS-style workers because the file contains refreshable tokens and ties runs to a user/workspace account. It may be acceptable only for trusted self-hosted deployments.

I would not build first-class ChatGPT auth passthrough until OpenAI exposes a cleaner delegated auth story for embedded Codex. Treat copied `auth.json` as a self-hosted escape hatch, not the product path.

## Pros

- No more global `process.chdir` hack if `thread/start.cwd` works as documented.
- Stdio transport avoids local port scanning and HTTP listener lifecycle problems.
- Protocol has explicit thread/turn semantics that map to Taico task runs better than generic session IDs.
- Cancellation is first-class with `turn/interrupt`.
- Model discovery is built in; Taico could stop hardcoding OpenAI model assumptions for Codex.
- Rich event taxonomy could produce better Taico live activity than current formatted OpenCode parts.
- MCP status/OAuth/tool APIs could let Taico expose better diagnostics for MCP failures.
- Type/schema generation gives us a path to version-pinned protocol types.

## Cons and gotchas

- App Server websocket is experimental and unsupported; do not build on it first.
- Docs position App Server for rich clients, not automation. That is a signal to evaluate SDK first.
- Protocol is large. A full client would be more code than the current OpenCode runner.
- Auth is not Taico-native. We would need a credential strategy before production use.
- Runtime MCP config story needs source-level verification. If config is mainly file-backed, workers must write isolated Codex config per run.
- Approvals can become a mismatch if Codex expects an interactive product loop and Taico treats runs as autonomous unless blocked by input requests.
- Codex may persist thread logs under Codex home by default. Need ensure worker isolation, retention, and cleanup match Taico's workspace lifecycle.
- Need confirm token usage events and exact event item shapes with generated schemas or the open-source Rust code.

## Suggested next spike

Build a disposable worker-local prototype before touching production runner selection:

- Add a small script under worker experiments that spawns `codex app-server` over stdio.
- Use a temporary `CODEX_HOME` per run so auth/config/session state is isolated.
- Initialize, `thread/start` with `cwd`, then `turn/start` with a simple repo summary prompt.
- Stream notifications and log event method names plus compact payload samples.
- Verify `turn/interrupt` actually stops work.
- Verify MCP config can be injected per run and Taico task/context MCP servers can be called.
- Verify token usage exists in app-server notifications or results.
- Compare with the same prototype using `@openai/codex-sdk`.

If the SDK gives enough event detail, use SDK for the first `CodexRunner` and keep App Server in reserve for richer UI features. If SDK hides too much, implement the minimal stdio JSON-RPC App Server client.

## Recommendation

Do not replace `OpenCodeAgentRunner` yet.

Create a separate experimental `CodexRunner` behind agent type `codex` or a feature flag, using either `@openai/codex-sdk` or stdio App Server after the spike. Keep OpenCode as the known working OpenAI harness until we verify auth, MCP injection, token usage, cancellation, and session cleanup under real Taico worker conditions.

The strongest case for Codex is not "OpenAI model access". We already have that through OpenCode. The strongest case is a cleaner, native OpenAI agent runtime with richer lifecycle events and less cwd/port nonsense. That is worth exploring, but auth and MCP need to pass before this becomes production runner work.
