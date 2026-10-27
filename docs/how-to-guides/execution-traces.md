# Raw worker execution traces

Workers capture every event exposed by their harness SDK before human-readable
formatters filter it. Claude partial messages and Copilot streaming are enabled.
Copilot registers its catch-all handler before session creation; OpenCode (also
used by the Codex runner) and ADK capture their entire event streams. This stores
SDK events, not the harness process's stdout/stderr or private internal state.

## Ownership and storage

`execution_traces` stores the original event as PostgreSQL JSON, with the stable
execution ID, a monotonically increasing sequence starting at 1, harness name,
optional session ID, worker timestamp and server receipt timestamp. The payload
is not normalized, summarized or redacted. JSON storage preserves escaped NULs and lone surrogates that JSONB rejects.
Payloads are snapshots of the SDK objects, not original wire bytes.

Traces survive the transition from active execution to execution history,
including stale executions. Traces belong only to an execution: there is no
direct task reference or task-deletion cascade. Deleting a task through the API
preserves its execution history and traces. There is no foreign key to the
transient active execution row; future execution cleanup must also delete the
execution’s traces. Trace events do not become comments or task activity
broadcasts. No UI is changed.

## Delivery

The worker snapshots SDK JSON synchronously and spools batches after one second,
100 events, or approximately 512 KiB. Batches are written atomically with private
file permissions under `<workingDirectory>/.taico/traces/<server-and-client-hash>`.
The spool checks pending batches every five seconds, including after a worker
restart using the same directory, server and OAuth client identity. Transient
failures back off from five seconds to five minutes without discarding batches.
Disconnected transports do not count as failed uploads, and reconnect immediately
clears backoff and drains the queue. A disconnect (including socket replacement)
cancels pending acknowledgement waits. Trace acknowledgement timeouts allow
64 KiB/s transfer time plus ten seconds for processing, capped at five minutes;
activity and heartbeat acknowledgements keep their five-second timeout. Files are
removed only after acknowledgement of a successful database insert. A unique
(execution ID, sequence) key makes retries idempotent. Delivery can be out of
order, so readers should use sequence numbers rather than receipt time.

`execution.trace.post` uses the authenticated worker WebSocket. The backend
validates each batch and checks the OAuth client owns the active or historical
execution. It acknowledges only after storage. Batches have at most 100 events;
the transport accepts up to 16 MiB per frame. Oversized batches and permanent server rejections are moved intact to a local
`failed/` directory and logged; later batches continue uploading. Oversized individual events are isolated from neighbouring small events by the
recorder’s byte-based batching. These files
require manual inspection and are never silently truncated or deleted. A worker crash can lose events
in the current unspooled batch (up to roughly one second). Disk write failures
are logged and may lose unspooled traces, but never change the execution result.
Non-JSON SDK events become diagnostic placeholders instead of aborting the run. No automatic retention
policy is applied yet; account for database and offline spool growth.

## Reading

`GET /api/v1/executions/:executionId/traces?afterSequence=0&limit=100` requires
`tasks:read`, matching execution-history access. It returns ordered `items` and
`nextAfterSequence`. Both active and historical executions are supported.
Consumers polling a running execution should overlap/reload earlier pages when
they need to detect events arriving late from a reconnecting worker; a sequence
cursor alone is not a guarantee of a complete stream.

Raw output can include prompts, file contents, tool arguments and tool results.
It has the same sensitivity as a harness transcript. There is no separate
transcript permission or payload sanitization in this initial version.


## Task trace panel

Task details show a collapsible **Execution traces** panel on wide desktop windows.
On phones, a compact entry between the task updates and runs replaces the live
activity slot and opens a full-screen trace view with
a Back to task control. The view traps focus, supports Escape, and restores focus
to its entry when closed. It accounts for safe areas and keeps task navigation
and comment actions behind the view. Tablet windows retain a collapsible section.
Its open state is remembered locally. Select an execution to view its messages, reasoning
summaries exposed by the harness, tool calls, arguments, output and errors.
Tool output and original raw events are expandable. Lifecycle-only and
unrecognized SDK events are omitted from the reading view, while all raw events
remain stored and available through the API. Token deltas and updated tool
snapshots are grouped for reading, with their underlying JSON inspectable.
Claude's per-block assistant events are reconciled with streaming block identities,
including when a page starts mid-message. ADK function calls and responses are
paired by call ID. Loading earlier events anchors the visible entry so concurrent
live updates do not move the reader's position.

The panel opens at the latest 100 raw events. `latest=true` selects the newest
page in chronological order. `beforeSequence` loads earlier pages, and
`hasMoreBefore` indicates whether another earlier page exists. Reading earlier
history preserves the scroll position. New output follows the bottom only when
the reader is already near it; **Jump to latest** resumes following.

After a batch is durably inserted, `ExecutionTracesChangedEvent` is mapped by the
executions gateway to `execution.traces.changed` with only the execution ID.
Authenticated readers with `tasks:read` join `execution-traces-<executionId>` via
`execution.traces.subscribe`. The panel fetches persisted events through REST on
notification, subscription acknowledgement, reconnect and a ten-second fallback.
It also subscribes to execution list changes to discover new runs. Collapsing
unmounts its subscription and stops its trace reads. Raw output is never included
in these notifications or broadcast to collection subscribers.


## Worker execution progress

Every stored event has an explicit `source`: `worker` for execution lifecycle
records, or `harness` for the agent conversation. Worker records have `harness:
null`; harness records retain the actual SDK name (Claude, OpenCode, etc.).
Older workers and existing agent traces default to `source: "harness"`.

New workers record `taico.execution.step` JSON events with `source: "worker"`.
They share the execution's sequence and durable spool with unchanged harness
payloads. The UI shows Prepare workspace, Set up agent, Run agent and Finish
execution with the walkthrough's connected status indicators. Repository events
report actual clone/fetch progress per project, including failures; remote URL
credentials are excluded from the display name. A workspace with no repositories
is reported explicitly.

The Run agent step includes harness-specific shutdown. Finish execution covers
saving the outcome (or returning an unsupported task to the queue); the workspace
is retained. Failed, cancelled and interrupted steps retain their actual outcome,
and finalization is recorded on those paths too. Missing completion events are
not treated as success when a worker becomes stale.

Every trace read includes `lifecycle`, the worker records for the entire execution,
independent of the raw-event page. This keeps preparation visible after thousands
of harness events without fetching the full transcript. A partial index on worker events keeps this
lookup independent of conversation size. New records use the same
execution-scoped change notifications and read permissions. Older workers/runs
without lifecycle events show that step details are unavailable.
