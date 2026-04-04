# Worker V1 -> V2 Migration Status

## What We Are Doing

We are migrating from the old worker model to `worker-v2`.

The old worker was centered around:
- long-lived manually provisioned agent tokens
- task event subscriptions
- agent message streaming over WebSocket
- a "run" concept traced via `x-taico-run-id`

The new worker is centered around:
- backend-owned execution decisions
- a worker authenticating as an OAuth client
- queue claiming and active execution APIs
- short-lived per-agent execution tokens requested on demand

## Where We Are

Current state:
- backend decides which tasks are ready to be worked on and puts them in the execution queue
- worker authenticates once as an OAuth client
- worker polls the execution queue and claims work
- worker starts an active execution for the claimed task
- worker requests a short-lived token for the assigned agent at execution time
- worker passes the runtime token and Taico base URL down into the agent runners
- no long-lived agent token setup is required
- agents can be added or updated from the UI without changing worker config

This is a major simplification compared to worker v1.

## What Is Missing

### Execution Tracing

The old worker used `x-taico-run-id` on MCP requests to trace downstream effects such as subtask creation.

We should revisit that design.

Open question:
- do we still need a separate run concept, or should execution become the primary traceability concept?

Likely direction:
- use execution as the first-class identity for worker activity
- only reintroduce a separate run concept if execution proves too coarse

Related doc:
- [worker-server-run-tracking-redesign-plan.md](/Users/franciscogalarza/github/ai-monorepo/docs/worker-server-run-tracking-redesign-plan.md)

### Live Agent Activity

The old worker streamed agent messages to the backend over WebSocket, and the UI showed them as live activity.

We want this again, but the activity should probably belong to an execution rather than directly to a task.

Open questions:
- what is the execution activity/event model?
- should activity be persisted, ephemeral, or both?
- how should runner sessions map to executions?

### Queue Realtime Events

The old worker listened to task events over WebSocket.

We do not need task events for worker-v2, but we do want queue-related realtime signals so workers do not rely only on polling.

Likely direction:
- keep polling as a fallback
- add queue-change realtime events so workers can react quickly when new work becomes available

### Active Execution Cancellation

Backend needs to be able to stop an active execution.

That means the worker needs a realtime channel for stop requests, most likely over WebSocket.

Missing pieces:
- backend event for "stop this execution"
- worker subscription/connection model for receiving it
- runner shutdown/cancel behavior per provider

### Task Deletion Semantics

Task deletion currently does not handle execution artifacts cleanly.

Desired behavior:
- if a task is in the queue, remove the queue entry when deleting the task
- if a task has an active execution, request that the worker stop it
- once execution is stopped and queue state is cleared, delete the task

This likely needs explicit backend orchestration so deletion is safe and deterministic.

## Suggested Next Steps

1. Decide whether execution replaces run as the primary traceability model.
2. Define execution-scoped live activity events and UI rendering.
3. Add worker realtime support for queue wakeups and execution stop requests.
4. Define backend deletion flow for tasks with queue or active execution state.
