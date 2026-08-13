# 06 — Execution and schedule hardening

Depends on: 01, 02.

The execution core is the reference implementation, so make targeted changes rather than rewrite it.

- [x] `stopTask` validates worker ownership; post-commit activity/queue notifications still need outbox delivery.
- Make stale-execution snapshot tag recovery conflict-safe.
- [x] Scheduled-task completion and rollback are conditioned on the claim's next-run value; `markAsExecuted` still needs retirement or isolation from the claim lifecycle.
- Replace queue-wide `clear`/delete-not-in-list reconciliation with serialized or generation-based cleanup that cannot erase concurrently claimed/queued work.
- Decide whether legacy `AgentRun` remains mutable; otherwise make execution ID authoritative and close write paths.

Acceptance criteria: no task is simultaneously queued and active after competing reconciliation/claim; reconfigured schedules cannot be completed by an old claim; worker A cannot stop worker B’s execution.
