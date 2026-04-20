# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Taico

Taico models execution, not life. Core primitives:

- **Task** - Unit of work with an assignee (human or agent). Status changes trigger runtime events.
- **Comment** - Work log inside tasks (discovery, decisions, progress, agent output).
- **Agent** - Harness + LLM/prompt that works on tasks. Always through access-controlled interfaces.
- **Thread** - Coordination when tasks branch into parallel work. Auto-created on subtask creation.
- **Context Block** - Addressable text that can be attached to tasks/threads/projects.
- **Agent Run** - Record of each time an agent works on a task (traceability).

Three doors into the system: REST API, WebSocket (real-time events), MCP. All access-controlled via scopes.

Full details: `docs/PRIMITIVES.md`

## Development

```bash
npm run build:dev     # Cloned -> ready: npm ci + full prod build via nx
npm run dev:[1-5]     # Start backend + both frontends with hot reload
```

Builds are orchestrated by **nx**. `build:dev` and `build:prod` both walk the dep graph and cache by content hash — re-running an already-built workspace returns in ~1s. See [Build System](docs/how-to-guides/build-system.md) for project.json conventions, the `assemble-public` pattern, cache behavior, and troubleshooting. The dependency graph itself lives in [dependencies.md](dependencies.md).

If you hit an "address in use" error, use `npm run dev:[1-5]` to pick a different stack (each has pre-configured ports and its own database via `stack[1-5].env`), or set `UI_PORT`, `LEGACY_UI_PORT`, and `BACKEND_PORT` env vars directly.

## After Making Changes

1. `npm run build:dev` — verify everything compiles
2. `npm run test:e2e` — run end-to-end tests
3. `npm run dev` — verify the app starts and works

## Architecture

### Package Structure

```
apps/
├── backend/         # NestJS 11 API server (SQLite + TypeORM)
├── llm-benchmarker/ # LLM benchmark and evaluation tooling
├── ui/              # React 19 + Vite frontend (active development)
├── ui-v1/           # DEPRECATED - only needs to compile
├── worker/          # Current worker runtime
└── worker-v1/       # Legacy worker runtime (being phased out)
packages/
├── adk-session-store/ # SQLite-backed Google ADK session service
├── client/            # Generated TypeScript API client package (`@taico/client`)
├── errors/            # Shared error classes and codes
├── events/            # Shared real-time event contracts
├── openapi-sdkgen/    # OpenAPI SDK generation tooling and tests
└── shared/            # Shared generated artifacts used by builds
```

**Important**:
- All UI work should be done in `apps/ui`. The `apps/ui-v1` package is deprecated and only maintained to ensure it compiles.
- Use `apps/worker` for new worker changes. `apps/worker-v1` is legacy and should only be touched for maintenance or migration work.

### Backend Modules

Key modules in `apps/backend/src/`:
- `tasks/` - Task management with MCP gateway
- `threads/` - Conversation thread management
- `agents/` - AI agent management
- `agent-runs/` - Agent execution tracking
- `context/` - Context blocks (prompt content with tags)
- `mcp-registry/` - Model Context Protocol server registry
- `authorization-server/` - OAuth2/OIDC implementation
- `identity-provider/` - Identity provider integration
- `auth/` + `auth-journeys/` - Authentication flows

### Layered Architecture Pattern

The backend follows strict layering:

```
Controller (HTTP/Transport) → Service (Business Logic) → Repository (Data)
```

**Key principles documented in `/docs/architecture/`:**

1. **Transport Independence**: Services never import HTTP exceptions. They throw domain-specific errors (e.g., `TaskNotFoundError`) that exception filters map to HTTP responses.

2. **Thin Controllers**: Controllers only handle routing, validation, and DTO transformation. All business logic lives in services.

3. **Type Separation**:
   - `dto/http/` - Request/Response DTOs with validation decorators
   - `dto/service/` - Plain TypeScript types (no decorators)
   - `errors/` - Domain-specific error classes

### API Generation Pipeline

OpenAPI artifacts are generated from the backend spec and flow through `packages/openapi-sdkgen`, then into consumable packages:
1. Backend builds and outputs `openapi.json`
2. `openapi-sdkgen` runs generation and validation for SDK artifacts
3. Generated outputs are published/consumed via `packages/client` (and supporting shared artifacts)
4. Frontend and other consumers import these packages for type-safe API calls

## Key Technologies

- **Backend**: NestJS 11, TypeORM, SQLite, Socket.io, MCP SDK
- **Frontend**: React 19 (ui), Vite, React Router 7, Radix UI
- **Testing**: Jest (backend), Vitest (frontend)
- **Real-time**: Socket.io WebSocket gateways per feature

## UI Development

For UI work, read `apps/ui/CLAUDE.md` first. It covers styling (tokens.css), primitives, shell patterns, and feature structure.

## Backend Development

Follow the guides in `/docs/architecture/` and `/docs/review-guides/`. Key documents:
- `controller-responsibilities.md` - Keep controllers thin
- `service-transport-independence.md` - No HTTP exceptions in services
- `dto-mapping-patterns.md` - DTO transformation patterns
- `enum-management.md` - Enum best practices

### Database Migrations

**CRITICAL**: When creating database migrations, you MUST register them in `apps/backend/src/app.module.ts`:
1. Import the migration class
2. Add it to the `migrations` array in chronological order
3. Migrations run automatically on app startup when `migrationsRun: true`

## Documentation

Extensive documentation in `/docs/`:
- `architecture/` - Core architectural decisions and patterns
- `review-guides/` - Checklists for entities, DTOs, controllers, MCPs, errors
- `how-to-guides/` - Implementation guides
- `how-to-guides/realtime-events.md` - Real-time domain events, gateway wiring, room topology, and UI sync principles
- `DEPLOYMENT.md` - Production deployment with Kubernetes and GitOps workflow

## MCP Integration

The project includes MCP (Model Context Protocol) support:
- Tasks MCP endpoint at `/api/v1/tasks/tasks/mcp`
- Claude Code settings in `.claude/settings.json` with MCP enabled
- Stop hook for commenting on transcripts
