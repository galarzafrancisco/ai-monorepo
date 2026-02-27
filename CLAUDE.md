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
npm run build:dev     # Install deps, generate API types, build all packages
npm run dev:[1-5]     # Start backend + both frontends with hot reload
```

If you hit an "address in use" error, use `npm run dev:[1-5]` to pick a different stack (each has pre-configured ports and its own database via `stack[1-5].env`), or set `UI_PORT`, `LEGACY_UI_PORT`, and `BACKEND_PORT` env vars directly.

## After Making Changes

1. `npm run build:dev` — verify everything compiles
2. `npm run test:e2e` — run end-to-end tests
3. `npm run dev` — verify the app starts and works

## Architecture

### Package Structure

```
apps/
├── backend/     # NestJS 11 API server (SQLite + TypeORM)
├── ui2/         # React 19 + Vite frontend (active development)
├── ui/          # DEPRECATED - only needs to compile
└── agents/      # AI agent runners (Claude, Gemini, CodeX)
packages/
└── shared/      # Auto-generated types and API client from OpenAPI
```

**Important**: All UI work should be done in `apps/ui2`. The `apps/ui` package is deprecated and only maintained to ensure it compiles.

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

The shared package auto-generates TypeScript types from the backend's OpenAPI spec:
1. Backend builds and outputs `openapi.json`
2. `openapi-typescript` generates types
3. `openapi-typescript-codegen` generates fetch-based API client
4. Frontend imports these for type-safe API calls

## Key Technologies

- **Backend**: NestJS 11, TypeORM, SQLite, Socket.io, MCP SDK
- **Frontend**: React 19 (ui2), Vite, React Router 7, Radix UI
- **Testing**: Jest (backend), Vitest (frontend)
- **Real-time**: Socket.io WebSocket gateways per feature

## UI Development

For UI work, read `apps/ui2/CLAUDE.md` first. It covers styling (tokens.css), primitives, shell patterns, and feature structure.

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
- `DEPLOYMENT.md` - Production deployment with Kubernetes and GitOps workflow

## MCP Integration

The project includes MCP (Model Context Protocol) support:
- Tasks MCP endpoint at `/api/v1/tasks/tasks/mcp`
- Claude Code settings in `.claude/settings.json` with MCP enabled
- Stop hook for commenting on transcripts
