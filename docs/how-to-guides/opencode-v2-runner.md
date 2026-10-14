# OpenCode v2 runner (proof of concept)

`apps/worker/src/runners/opencode-v2/` holds a second OpenCode runner. It uses the `@opencode-ai/sdk/v2` server/client API. It sits **next to** the current `OpenCodeAgentRunner`, and `task-runner.ts` does **not** use it yet. This page covers how it works, how to run its parity suite, and the rollout decision.

Background research: context block *OpenCode v2 worker integration assessment*.

## What it does differently

| Concern | Current runner (`OpenCodeAgentRunner`) | v2 runner (`OpenCodeV2AgentRunner`) |
|---|---|---|
| Version | SDK `^1.x`, any CLI on `PATH` | SDK pinned to `1.19.0`. Before spawning `serve`, the run checks `<bin> --version` and fails with `OpencodeVersionMismatchError` if it differs from `OPENCODE_PINNED_VERSION`, so no server process starts. After startup, `GET /global/health` must report the same version |
| Working directory | Global `process.chdir` lock (`initBullshit`) | Child spawned with `cwd` + v2 client `directory`. No global state |
| Port | Tries ports 4000–4100 one by one | Picks a free loopback port and retries up to 3 times if another process takes it first. Not `--port 0`, which always tries 4096 first (see below) |
| Server access | Unauthenticated loopback | Random per-run `OPENCODE_SERVER_PASSWORD` (basic auth) |
| Teardown | Kills the process group | Takes a snapshot of the whole process tree, then SIGTERM → SIGKILL. `run()` settles only after **every** process in the snapshot is gone, including tool shells and local MCP servers in other process groups |
| Events | Stops at the first `session.idle` from **any** session | Only events from the owned session (and sub-agent sessions it spawns) count. `session.error` fails the run |
| SSE loss | Not handled | Reconnects, then checks `session.status` + messages to see whether the run already finished. Gives up with `OpencodeEventStreamLostError` after `maxReconnects` attempts |
| Permissions | OpenCode defaults | Explicit Taico policy (`DEFAULT_TAICO_OPENCODE_POLICY`). `ask` goes to an approver with a timeout. Headless default is reject |
| MCP | Passed through | Runs check `mcp.status`, and a run fails before the prompt if a remote MCP is not `connected`. The error message contains no URL or headers. OAuth auto-detection is disabled |
| Usage / result | Partial, taken from stream events | Stream events give a live preview. The final tokens and cost are summed from all assistant messages, and the result is the final assistant text |

## Running the parity suite

The suite starts the **real** pinned `opencode serve`. It talks to a scripted OpenAI-compatible mock LLM, a mock Taico MCP that checks bearer tokens, and a stdio MCP. It uses temporary HOME/XDG directories, so it needs no LLM credentials and never touches your own OpenCode config.

```bash
npm install --no-save --prefix /tmp/opencode-1.19.0 opencode-ai@1.19.0
TAICO_OPENCODE_BIN=/tmp/opencode-1.19.0/node_modules/.bin/opencode \
  npm -w apps/worker run test:opencode-v2
```

- If the pinned CLI is not found, the suite is skipped. With `TAICO_OPENCODE_REQUIRED=1` it fails instead, which is how CI runs it (`.github/workflows/test.yml`).
- `npm -w apps/worker run test:unit` covers the pure helpers (attribution, completion detection, usage, policy, boundary).
- To upgrade OpenCode, change `OPENCODE_PINNED_VERSION`, the SDK version in `apps/worker/package.json`, and the CI install step together, then run the suite again.

## Acceptance criteria and results

Results are from `opencode-ai@1.19.0` + `@opencode-ai/sdk@1.19.0` on linux/arm64. All 32 integration tests pass. Each criterion maps to a `describe` block in `parity.itest.ts`.

1. **Lifecycle: PASS.** Startup has a time limit and both CLI and server versions are checked. Anonymous requests get 401. The cwd and config are verified through the API. A busy explicit port fails within the time limit. A startup timeout kills the tree. After a full run, the server, a backgrounded `sleep` from bash, a local MCP server and that MCP's own child are all dead.
2. **Events: PASS.** Two concurrent executions each see only their own text and tools. A second session started by someone else on the *same* server is ignored. A provider 400 fails the run through `session.error`. An SSE drop in the middle of a tool call recovers. An SSE connection that stays broken fails in about 11s, well before a 30s tool call would finish.
3. **MCP authorization: PASS.** An authorized remote MCP call reaches the mock with that execution's ID. A bad token fails the run before the LLM is ever called. A token that expires mid-run never reaches `tools/call`. Two concurrent runs never swap tokens. The token never shows up in emitted events, errors, console logs or raw events.
4. **Permissions: PASS.** `allow` runs the tool. `deny` blocks `bash`, `edit`/`write` and MCP tools (`taico_*`). `ask` is rejected when no approver is set, and also when the approver never answers (timeout). An approved `ask` runs the tool. With `external_directory: deny`, a `read` outside the workspace is blocked.
5. **Cancellation: PASS.** Cancelling before spawn never starts a server. Cancelling during startup kills the tree. Cancelling after session creation stops the run before any LLM request. Cancelling during `sleep 120` in bash kills the shell and `finished.txt` is never written. Cancelling during a hung LLM request works, and so does `runner.cancel()`. Every case is reported as `InterruptedExecutionError`, after teardown has finished.
6. **Usage and workspace boundary: PARTIAL.**
   - Usage over 3 steps adds up exactly (input 600, output 90, cost equal to the model price times tokens).
   - For the `none`, `one` and `many` layouts, `pwd` matches cwd. A `read` through `../..` is blocked, a `write` outside the workspace is blocked, and `cat <absolute outside path>` is blocked.
   - A cwd outside the workspace root, including one reached through a symlink, is refused before the server starts.
   - **Gap:** `cat "$(echo <base64> | base64 -d)"` *does* read the outside file. OpenCode only spots literal paths in shell commands. The test named `KNOWN GAP` checks that this escape still works, so it will start failing if OpenCode ever adds real sandboxing.

## Rollout decision

**Do not replace the production runner yet.** Criteria 1–5 pass. Criterion 6 cannot be fully met by OpenCode alone: its permission rules are policy, not isolation. The assessment said that if OS-level isolation cannot be shown, isolating the container or workspace becomes a rollout prerequisite. Next steps:

1. Run OpenCode executions under OS isolation (a container or sandbox per execution, or at least a separate uid with only the workspace mounted). Then add a parity test showing the obfuscated escape is blocked.
2. Then switch `task-runner.ts` to `OpenCodeV2AgentRunner` for `opencode`/`codex` agents, keeping the old runner behind a flag for one release.
3. Shared-server pooling stays out of scope. Prove per-run security first.

## Known limitations / tech debt

- **Credentials in the child's environment.** The MCP bearer tokens go to OpenCode through `OPENCODE_CONFIG_CONTENT`, so any process running as the same uid can read them from `/proc/<pid>/environ`. Isolation (item 1 above) also fixes this.
- **Shared OpenCode data directory.** In production, concurrent servers share `~/.local/share/opencode` (sessions DB, snapshots), as the current runner does. The parity suite isolates it per sandbox. Concurrency against one real user's data dir has not been stress-tested.
- **No stall watchdog.** A stream that stays open but sends nothing is not detected, only real disconnects. Long tool calls without events are legitimate, so add a watchdog only together with status polling.
- **Windows.** Tree kill uses `taskkill /T` and is untested. Collecting the descendant snapshot is POSIX-only.
- **Real providers.** All criteria were tested against the mock provider. Before switching over, do a smoke run with a real provider (e.g. `openai/gpt-5.4`).
- **Why not `--port 0`.** With `--port 0`, OpenCode 1.19.0 tries port 4096 first. When servers start one after another, Node's shared keep-alive pool then sends the new server's first requests on a socket to the dead previous server, giving `ECONNRESET`.
