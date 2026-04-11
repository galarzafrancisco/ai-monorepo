# Agent Run Deprecation

This document is historical.

Taico no longer uses **Agent Runs** as the active runtime model. The system is now execution-centric.

Current model:

- workers claim eligible work from backend-managed execution state
- workers start and update executions
- execution identity is the runtime identity for agent work

If you are working on current code, use the executions surfaces under [`apps/backend/src/executions`](/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/executions) and the current worker under [`apps/worker`](/Users/franciscogalarza/github/ai-monorepo/apps/worker).

Any references to `agent-runs`, `run-id`, or orchestrator-era behavior should be treated as legacy migration context only.
