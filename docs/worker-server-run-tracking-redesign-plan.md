# Worker Server Run Tracking Redesign Implementation Plan

This plan is derived from context block `307ce186-f0f0-4e09-875c-a7460fdeb924` and updated with follow-up architecture feedback from task `485fa054-ce1d-4f97-b5d2-9b1707103654`.

Scope: move run selection and orchestration authority from the worker process to backend-owned state machines, transition runtime ownership to an execution-centric model, and keep old-worker compatibility during migration.

## Updated architecture direction

- Runtime source of truth is `TaskExecution` (or a hard repurpose of `AgentRun` into equivalent execution semantics, not both parallel models).
- `WorkerSession` tracks connected worker inventory/heartbeat lifecycle.
- New worker paths should use execution-id context for agent-originated child-task/thread actions.
- Legacy `run-id` header and `/api/v1/agent-runs` API remain available as a compatibility facade during migration (dual stack), backed by the execution-context resolver.
- Optional immutable execution-event history can be added later; it is not required for the first migration.

## TODO List

1. **Establish execution persistence model**
   - Add `WorkerSession` entity and schema.
   - Add `TaskExecution` entity and schema with lifecycle statuses (`READY`, `CLAIMED`, `RUNNING`, `STOP_REQUESTED`, `COMPLETED`, `FAILED`, `CANCELLED`, `STALE`).
   - Register migrations in `apps/backend/src/app.module.ts`.

2. **Define execution-centric runtime model (replace/repurpose legacy `AgentRun`)**
   - Remove ambiguity between "run context" and "execution state" by making `TaskExecution` the authoritative runtime row.
   - Preserve actor/task inheritance semantics currently provided by run-id context, but attach them to execution context.
   - Choose one path only: full replacement of `AgentRun` or hard repurpose of `AgentRun` to execution semantics.

2.5 **Migrate API/MCP context propagation to execution context with compatibility**
   - Update auth/decorator/service plumbing that currently reads `runId` (task child creation + thread inheritance path) to resolve execution context authoritatively.
   - Enforce actor ownership checks against execution context (`executionId -> actorId -> parentTaskId/parentThreadId`).
   - Preserve legacy `run-id` behavior by mapping compatibility run ids to the same execution-context resolver while old workers remain active.

2.6 **Add AgentRun compatibility facade (dual stack)**
   - Keep `/api/v1/agent-runs` contract for old worker compatibility, but back create/read context operations with `TaskExecution`-centric state.
   - Ensure old worker flow (`createAgentRun` -> runner sends `run-id`) keeps parent-task/thread inheritance semantics unchanged.
   - Define facade removal criteria tied to old worker retirement, then remove it in a later cleanup step.

3. **Implement backend execution reconciler**
   - Listen to task domain events (`created`, `updated`, `assigned`, `status_changed`, input request updates).
   - Recompute eligibility in backend and upsert/cancel `TaskExecution` rows accordingly.
   - Add dependency fan-out reevaluation when prerequisite tasks transition to `DONE`.

4. **Implement atomic claim and dispatch services**
   - Introduce claim logic using guarded SQL update (same safety shape as scheduled task claiming).
   - Ensure multi-worker safe ownership with lease semantics (`leaseExpiresAt`).

5. **Add dedicated `/workers` gateway protocol**
   - Implement worker control namespace and message contracts for `hello`, `heartbeat`, run requests, lifecycle updates, and stop flow.
   - Persist worker presence and execution lifecycle transitions via backend services.

6. **Update worker to execution-engine mode**
   - Replace local task-pick logic with handling of explicit server-assigned runs.
   - Keep local runners; remove worker-owned trigger/dependency readiness decisions.

7. **Implement heartbeat expiry and orphan handling**
   - Mark stale/offline sessions.
   - Reap or requeue orphaned executions based on execution state and lease expiry.

8. **Deprecate old coordinator scheduler paths**
   - Remove worker-side reconcile loop and websocket-trigger scheduler behavior after backend dispatch is stable.
   - Preserve user-visible telemetry via backend-driven state + websocket updates.

9. **Validation and rollout safety**
   - Add/adjust tests for reconciler behavior, claim race safety, worker protocol transitions, and stale execution recovery.
   - Add rollout notes and fallback strategy for phased cutover.
   - Explicitly verify that child-task creation/inheritance can resolve context in both compatibility and execution-id-first paths during migration.
