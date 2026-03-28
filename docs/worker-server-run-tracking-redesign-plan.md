# Worker Server Run Tracking Redesign Implementation Plan

This plan is derived from context block `307ce186-f0f0-4e09-875c-a7460fdeb924` and is scoped to move run selection and orchestration authority from the worker process to backend-owned state machines.

## TODO List

1. **Establish execution persistence model**
   - Add `WorkerSession` entity and schema.
   - Add `TaskExecution` entity and schema with lifecycle statuses (`READY`, `CLAIMED`, `RUNNING`, `STOP_REQUESTED`, `COMPLETED`, `FAILED`, `CANCELLED`, `STALE`).
   - Register migrations in `apps/backend/src/app.module.ts`.

2. **Extend `AgentRun` as historical attempt record**
   - Link `AgentRun` to `taskExecutionId` and `workerSessionId`.
   - Keep attempt timestamps (`startedAt`, `endedAt`, `lastPing`) as authoritative history for each execution attempt.

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
