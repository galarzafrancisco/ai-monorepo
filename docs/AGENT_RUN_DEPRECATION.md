# AgentRun API Deprecation Plan

## Status: Legacy Compatibility Facade (Active)

The `/api/v1/agent-runs` endpoints and `run-id` header context propagation are maintained as a **compatibility facade** during the worker server run tracking redesign migration.

## Background

As part of the [Worker Server Run Tracking Redesign](./worker-server-run-tracking-redesign-plan.md), the system is transitioning from a run-based model to an **execution-centric model** where:

- **TaskExecution** is the authoritative runtime state (single source of truth)
- **WorkerSession** tracks worker lifecycle and heartbeat
- **execution-id** header is the primary context propagation mechanism
- **AgentRun** remains as a compatibility layer for old workers

## Current Dual-Stack Operation

### New Path (Execution-Centric)
- Workers use `execution-id` header for context propagation
- TaskExecution is created by backend reconciler based on task eligibility
- All operations resolve context via `ExecutionContextResolverService` prioritizing execution-id
- AgentRun may optionally link to TaskExecution via `taskExecutionId` field

### Legacy Path (Run-Based Compatibility)
- Old workers use `run-id` header for context propagation
- Workers call `POST /api/v1/agent-runs` to create a run record
- AgentRun provides actor/parent-task inheritance for child task creation
- ExecutionContextResolverService falls back to run-id resolution when execution-id is absent

## What Remains During Migration

The following are **preserved for backward compatibility**:

1. **HTTP Endpoints**: `/api/v1/agent-runs` (GET, POST, PATCH)
2. **HTTP Header**: `x-taico-run-id` accepted alongside `x-taico-execution-id`
3. **Database Table**: `agent_runs` with all existing columns
4. **Context Resolution**: `ExecutionContextResolverService.resolveFromRunId()` fallback path
5. **Child Task Inheritance**: Tasks created with run-id header inherit parent task/thread

## Removal Criteria

The AgentRun compatibility facade will be removed when **ALL** of the following criteria are met:

### 1. Worker Migration Complete
- [ ] All production worker deployments upgraded to versions that use `execution-id` header
- [ ] All worker code paths updated to use TaskExecution-based flow
- [ ] Worker configuration validated to disable legacy run creation

### 2. Zero Legacy Usage
- [ ] Metrics show zero requests with `run-id` header (without `execution-id`) for 30 consecutive days
- [ ] Metrics show zero calls to `POST /api/v1/agent-runs` for 30 consecutive days
- [ ] Database query confirms zero AgentRuns created in the last 30 days without linked `taskExecutionId`

### 3. Data Migration Complete
- [ ] All existing AgentRuns have been linked to TaskExecutions (backfill if needed)
- [ ] No orphaned AgentRuns exist (runs without corresponding TaskExecution)
- [ ] Historical data archived or migrated to execution-centric representation

### 4. Monitoring and Validation
- [ ] Backend logs show no deprecation warnings for 30 days
- [ ] All integration tests pass without using run-id paths
- [ ] Worker e2e tests validate execution-id-only operation

### 5. Documentation and Communication
- [ ] Worker deployment guide updated to remove run-id references
- [ ] Migration runbook completed and validated
- [ ] Stakeholders notified of removal timeline (minimum 30 day notice)

## Removal Steps (Future)

Once all criteria are met, removal will proceed in this order:

1. **Phase 1: Soft Deprecation (Current State)**
   - Add deprecation warnings to logs when legacy path is used
   - Update API documentation with deprecation notices
   - Monitor usage metrics

2. **Phase 2: Hard Deprecation** (Future)
   - Return HTTP 410 Gone for `POST /api/v1/agent-runs` after 30-day warning
   - Reject requests with `run-id` header (without execution-id) with HTTP 400
   - Keep GET endpoints read-only for historical data access

3. **Phase 3: Full Removal** (Future)
   - Remove AgentRuns endpoints from routes
   - Remove `run-id` header handling from ExecutionContextResolverService
   - Drop `agent_runs` table via migration
   - Remove AgentRunEntity, AgentRunsService, AgentRunsController
   - Update OpenAPI spec and regenerate client types

## Migration Support

### For Worker Developers

**Before Migration:**
```typescript
// Old worker code
const run = await api.createAgentRun({ parentTaskId, actorId });
await api.createTask({ name, description }, { headers: { 'x-taico-run-id': run.id } });
```

**After Migration:**
```typescript
// New worker code (execution-id provided by backend)
const executionId = await getAssignedExecutionId(); // from worker gateway
await api.createTask({ name, description }, { headers: { 'x-taico-execution-id': executionId } });
```

### For Backend Developers

When working with execution context:
- Always use `ExecutionContextResolverService.resolveContext(executionId, runId)`
- Never assume only one context type exists
- Prefer execution-id in new code paths
- Log warnings when run-id path is taken

## Questions?

See also:
- [Worker Server Run Tracking Redesign Plan](./worker-server-run-tracking-redesign-plan.md)
- [Task Execution Model](./PRIMITIVES.md)
- [ExecutionContextResolverService](/apps/backend/src/executions/execution-context-resolver.service.ts)

For questions about this deprecation, contact the platform team or reference the implementation plan.
