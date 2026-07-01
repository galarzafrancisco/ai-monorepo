# Worker Migration Status

This document is historical.

The migration from the old worker model to the current execution-centric worker has effectively landed:

- the backend owns execution readiness and lifecycle
- the worker claims work and starts executions
- short-lived execution-scoped tokens are used at runtime
- `apps/worker` is the current worker runtime

If you need the current architecture, use:

- [`docs/PRIMITIVES.md`](PRIMITIVES.md)
- [`apps/backend/src/executions/ARCHITECTURE.md`](../apps/backend/src/executions/ARCHITECTURE.md)
- [`apps/worker/README.md`](../apps/worker/README.md)

Do not use this file as an implementation plan for new work.
