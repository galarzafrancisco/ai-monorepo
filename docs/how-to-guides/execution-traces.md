# Raw worker execution traces

Workers capture every event exposed by their harness SDK before human-readable
formatters filter it. Claude partial messages and Copilot streaming are enabled.
Copilot registers its catch-all handler before session creation; OpenCode (also
used by the Codex runner) and ADK capture their entire event streams. This stores
SDK events, not the harness process's stdout/stderr or private internal state.

## Ownership and storage

`execution_traces` stores the original event as PostgreSQL JSONB, with the stable
execution ID, a monotonically increasing sequence starting at 1, harness name,
optional session ID, worker timestamp and server receipt timestamp. The payload
is not normalized, summarized or redacted. JSONB preserves JSON content, not
original whitespace or object-key ordering.

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
The spool retries pending batches every five seconds, including after a worker
restart using the same directory, server and OAuth client identity. Files are
removed only after acknowledgement of a successful database insert. A unique
(execution ID, sequence) key makes retries idempotent. Delivery can be out of
order, so readers should use sequence numbers rather than receipt time.

`execution.trace.post` uses the authenticated worker WebSocket. The backend
validates each batch and checks the OAuth client owns the active or historical
execution. It acknowledges only after storage. Batches have at most 100 events;
the transport accepts up to 16 MiB per frame. Oversized individual events remain
in the pending spool rather than being truncated. A worker crash can lose events
in the current unspooled batch (up to roughly one second). Disk write failures
are logged and a final spool failure fails the execution. No automatic retention
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

Task details show a collapsible **Agent traces** panel on wide desktop windows.
On phones, a compact entry above the task opens a full-screen trace view with
a Back to task control. The view traps focus, supports Escape, and restores focus
to its entry when closed. It accounts for safe areas and keeps task navigation
and comment actions behind the view. Tablet windows retain a collapsible section.
Its open state is remembered locally. Select an execution to view its messages, reasoning
summaries exposed by the harness, tool calls, arguments, output and errors.
Tool output and original raw events are expandable. Lifecycle-only and
unrecognized SDK events are omitted from the reading view, while all raw events
remain stored and available through the API. Token deltas and updated tool
snapshots are grouped for reading, with their underlying JSON inspectable.

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
