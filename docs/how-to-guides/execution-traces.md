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
