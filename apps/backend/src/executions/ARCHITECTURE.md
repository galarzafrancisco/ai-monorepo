# Executions Architecture

This document captures the architectural decisions made so far for `executions`.

The goal is to keep the model simple while we build the readiness pipeline first, then evolve execution management later.

## Core Model

Executions model runtime state as three separate persistent surfaces:

- `queue`
  Presence means the task is ready to be picked up.
- `active`
  Presence means the task is currently being worked on.
- `history`
  Presence means the task was worked on in the past.

This is the current mental model:

```text
todo  -> queue
doing -> active
done  -> history
```

Absence is meaningful:

- no queue row => task is not ready
- no active row => task is not currently running

## Why We Split These Tables

We explicitly decided not to use one general-purpose executions table for everything.

Reasons:

- readiness is a different concern from active execution tracking
- active execution is a different concern from historical audit
- the queue should stay easy to reason about: presence means ready
- the readiness populator should not need to interpret mixed execution statuses

This keeps the first implementation intentionally boring:

- queue membership is derived state
- active execution rows represent in-flight work
- history rows represent completed past work

## Current Tables

### `task_execution_queue`

Minimal queue table.

- `task_id`

Properties:

- one row per task
- one-to-one with task by `task_id`
- presence means ready

### `active_task_executions`

Minimal active execution table.

- `id`
- `task_id`

Properties:

- row exists while the task is actively being worked
- readiness logic excludes tasks present here

### `task_execution_history`

Minimal history table.

- `id`
- `task_id`

Properties:

- append-only conceptually, even if the implementation is still minimal
- intended to become the audit trail over time

## Readiness Ownership

Readiness lives in `executions/readiness`.

The current owner service is:

- `TaskExecutionQueuePopulatorService`

Its job is:

1. decide whether a task should be in the queue
2. upsert the queue row if yes
3. delete the queue row if no

It does not manage active execution lifecycle.
It does not manage history.

## Readiness Triggers

There are two trigger types:

- event-driven
- scheduler-driven

Current adapters:

- `TaskEligibilityEventSourceService`
- `TaskEligibilitySchedulerService`

These are intentionally thin.
They trigger queue population work, but they do not own readiness logic themselves.

## Readiness Candidate Selection

We decided that readiness-specific SQL should live inside `executions`, not inside the `tasks` module.

Reason:

- readiness selection depends on execution-owned concepts such as "task is not already active"
- this is not a generic task query

Current owner:

- `ReadinessCandidateRepository`

This repository performs the first SQL cut for candidate tasks:

- task is not `DONE`
- task has an assignee
- task does not already have an active execution

Then the populator applies the remaining readiness rules in application logic.

## Agent Lookup Boundary

We decided not to query the agent repository directly from executions.

Instead:

- `executions` imports `AgentsModule`
- readiness uses `AgentsService`

Reason:

- agent retrieval belongs to the agents domain
- executions may depend on that domain, but should not reach into its repository directly

We also optimized scheduler-driven queue population to batch-load agents once for the whole task set, instead of fetching one agent per task.

## Current Readiness Rules

The current queue population logic uses these rules:

1. candidate task must survive the SQL first cut
2. assigned agent must exist and be active
3. task status must match the agent's `statusTriggers`
4. task tags must match the agent's `tagTriggers`
5. if the agent has no `tagTriggers`, it reacts to all tags
6. all dependency tasks must already be `DONE`
7. agent concurrency must not be exceeded, counting the agent's active executions **and** its tasks already in the queue (counting only running ones let one sweep queue every waiting task at once)

Queueing and claiming both take a slot, so both hold the agent's transaction-scoped advisory lock (`agent-concurrency:<actorId>`, `lockAgentSlots`) while they count and write:

- **Queueing** (`TaskExecutionQueuePopulatorService`) counts running plus queued and inserts the queue entry in one transaction. Without the lock, two of the agent's tasks reconciled at once (two task events) could both see the last free slot and both be queued.
- **Claiming** (`ActiveTaskExecutionService.claimTask`) counts what the agent already runs and refuses at the limit with `AgentConcurrencyLimitReachedError` (409). The refusal rolls back, so nothing is claimed. This guards entries queued before the limit was lowered, or by hand.

## When the queue is re-checked

- **Task events** (created, updated, assigned, status changed, input request answered) re-check that one task.
- **Execution changes** (`ActiveExecutionsChangedEvent`: claim, stop, unclaim, prune) re-check every candidate task, coalesced and never overlapping, so a waiting task is queued as soon as its agent has a free slot.
- **Every minute**, a full sweep (`TaskEligibilitySchedulerService`).

## Stale executions

An active execution is stale when either:

- it hasn't sent an execution heartbeat for `EXECUTIONS_STALENESS_THRESHOLD_MS` (default 10 min). Agents only heartbeat on activity, and a quiet tool call can legitimately run long; or
- its worker went quiet for `EXECUTIONS_WORKER_GONE_MS` (default 2 min): both the claim and the worker's last contact are older than that, and the execution hasn't heartbeated in that time either. Workers heartbeat every 30s whatever their agent is doing, so this catches a worker that dies right after claiming. It applies only to workers that have ever sent a worker heartbeat (`workers.last_heartbeat_at`, set only by heartbeats); older workers that never do keep the first rule.

The scan runs every minute (`EXECUTIONS_STALENESS_SCAN_CRON`, default `* * * * *`), so a worker that stops releases its agent's slots within about 3 minutes.

The scan only nominates executions. The pruner checks each one again in the transaction that deletes it, with the row locked (`findStaleExecutions({ manager, executionId })`), so one whose worker came back or whose agent heartbeated since the scan is left running.

Pruning records `STALE` in history and puts the task back as it was before the claim, so it runs again, **but only if the agent left it unfinished**: same assignee, and status unchanged or In progress. A task the agent finished (Done, For review) or handed to someone else is left as it is; rolling it back would run finished work a second time.

Still pending:

- open input request / open questions checks

## Controllers

We decided that all execution surfaces live under `/executions`.

Current endpoints:

- `/executions/queue`
- `/executions/active`
- `/executions/history`

These are currently read-only inspection endpoints.

## Schema Management

We decided not to rely on development mode alone for TypeORM schema synchronization.

Instead, schema behavior is controlled explicitly with:

- `TYPEORM_SCHEMA_MODE=sync`
- `TYPEORM_SCHEMA_MODE=migrate`

That keeps the "use sync temporarily while iterating" workflow explicit.

## Naming Direction

We moved away from the old "eligibility reconciler" naming.

Current naming preference:

- talk in terms of queue population
- use queue/active/history as the primary concepts

This better matches the actual mental model and keeps the implementation language aligned with the product language.
