# Worker Server Run Tracking Redesign Plan

This document is historical.

It described the migration from the old run-based worker model to the current execution-centric design.

That migration has been superseded by the current architecture:

- executions are the runtime record
- workers, not an orchestrator, execute agent work
- current execution work lives under [`apps/backend/src/executions-v2`](/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/executions-v2)
- current worker implementation lives under [`apps/worker`](/Users/franciscogalarza/github/ai-monorepo/apps/worker)

For current behavior and terminology, use [`docs/PRIMITIVES.md`](/Users/franciscogalarza/github/ai-monorepo/docs/PRIMITIVES.md) and the `executions-v2` architecture docs instead.
