# 02 — Task, tag, and project aggregates

Depends on: 01. Blocks: 03, 06.

Replace cross-service task/tag/project mutation chains with use cases:

- [x] `CreateTask`, `UpdateTask`, `AssignTask`, `TransitionTaskStatus`, `DeleteTask`, and task-comment creation now use one transaction plus an outbox record.
- [x] Input-request create/answer, artefact creation, and direct task-tag attach/remove now use a transaction plus an outbox record.
- [x] `CreateTaskInThread` atomically creates the child task and its parent-thread attachment/state aggregate.
- [x] Common tag find/create/associate/disassociate component, used by task/context/thread/blueprint operations.
- [x] `CreateProject`/`DeleteProject` are transactional; implicit `project:` tag ownership still needs consolidation.

Key invariants/tests:

- No task survives without its requested valid dependencies and tag joins after a failed create.
- Final comment and DONE status commit together.
- Competing tag creation produces one tag and correct join/usage semantics.
- Task-tag orphan cleanup counts task, context block, thread, and blueprint references in the same transaction. Migrate context/thread callers to the same component next.
- Project deletion has an explicit policy for its tag references.

Add data audit/repair migration only after reviewing production findings.
