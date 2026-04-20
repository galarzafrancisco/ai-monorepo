# Developer Guide

This guide covers local development, architecture, and validation.

## Prerequisites

- Node.js 24+
- npm 10+

## Local Development

Build everything:

```bash
npm run build:dev
```

This is `npm ci` + a full nx-orchestrated prod build. nx caches by content hash, so re-runs are near-instant. For details on the build system (dep graph, cache, troubleshooting), see [Build System](how-to-guides/build-system.md).

Run a dev stack:

```bash
npm run dev
```

If ports are busy, use one of the stack scripts:

```bash
npm run dev:1
npm run dev:2
npm run dev:3
npm run dev:4
npm run dev:5
```

Each stack has its own ports and SQLite database via `stack[1-5].env`.

## Worker Against A Dev Stack

Run the app stack in one terminal, then run the worker in another:

```bash
npm run dev:1
```

Then:

```bash
npm run taico:worker:1
```

Equivalent scripts exist for stacks `2` through `5`.

This split is intentional:

- `dev:[1-5]` keeps backend and UI in watch mode
- `taico:worker:[1-5]` runs the worker against that stack

## Validation

After changes:

1. `npm run build:dev`
2. `npm run test:e2e`
3. `npm run test:e2e:worker-auth`
4. `npm run dev`

## Architecture

### Package Structure

```text
apps/
├── backend/         # NestJS 11 API server
├── ui/             # Active React frontend
├── ui-v1/          # Deprecated frontend, compile-only
├── worker/          # Current worker runtime
└── worker-v1/       # Historical worker runtime
packages/
├── client/          # Generated API client
├── openapi-sdkgen/  # SDK generation tooling
└── shared/          # Shared contracts and generated artifacts
```

All new UI work goes in `apps/ui`. All new worker work goes in `apps/worker`.

### Layering

The backend follows:

```text
Controller -> Service -> Repository
```

Key rules:

- controllers stay thin
- services stay transport-independent
- DTOs and domain types stay separated

See:

- [Controller Responsibilities](/Users/franciscogalarza/github/ai-monorepo/docs/architecture/controller-responsibilities.md)
- [Service Transport Independence](/Users/franciscogalarza/github/ai-monorepo/docs/architecture/service-transport-independence.md)
- [DTO Mapping Patterns](/Users/franciscogalarza/github/ai-monorepo/docs/architecture/dto-mapping-patterns.md)
- [Enum Management](/Users/franciscogalarza/github/ai-monorepo/docs/architecture/enum-management.md)

### Execution Model

The current runtime model is execution-centric.

- the backend decides task eligibility
- workers claim tasks from execution state
- workers start and update executions
- execution activity is the runtime trace

If older docs mention agent runs or an orchestrator, treat that as historical terminology.

### Threads

Threads carry a parent goal plus a required state context block.

As attached tasks evolve, thread-level reconciliation updates that shared state so agents working inside the thread can read the current parent goal and shared context rather than relying only on their local task history.

### API Generation

The OpenAPI pipeline is:

1. backend emits `openapi.json`
2. SDK generation runs
3. generated artifacts flow into `packages/client` and shared outputs
4. consumers import generated types and client code

`npm run build:dev` handles this in the normal development flow.

### Real-Time

Socket.io gateways provide real-time behavior across the app. Workers also use realtime channels alongside execution APIs.

For implementation details, see [Realtime Events](/Users/franciscogalarza/github/ai-monorepo/docs/how-to-guides/realtime-events.md).

## UI Development

Read [`apps/ui/CLAUDE.md`](/Users/franciscogalarza/github/ai-monorepo/apps/ui/CLAUDE.md) before making UI changes.

## Backend Development

Follow the architecture and review guides under `docs/architecture/` and `docs/review-guides/`.
