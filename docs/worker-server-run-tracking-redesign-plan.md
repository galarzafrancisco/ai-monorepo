# Worker Server Run Tracking Redesign Plan

This document is historical.

It described the migration from the old run-based worker model to the current execution-centric design.

That migration has been superseded by the current architecture:

- executions are the runtime record
- workers, not an orchestrator, execute agent work
- current execution work lives under [`apps/backend/src/executions`](../apps/backend/src/executions)
- current worker implementation lives under [`apps/worker`](../apps/worker)

For current behavior and terminology, use [`docs/PRIMITIVES.md`](PRIMITIVES.md) and the `executions` architecture docs instead.
