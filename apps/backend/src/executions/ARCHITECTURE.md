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
7. agent concurrency must not be exceeded based on current active executions

Still pending:

- open input request / open questions checks
- stale execution handling

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
