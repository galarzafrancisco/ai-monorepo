# Developer Guide

This guide covers setting up the development environment, understanding the architecture, and contributing to Taico.

## Prerequisites

- Node.js 20+
- npm 10+

## Getting Started

### One-Command Setup

```bash
npm run zero-to-prod
```

This installs dependencies, generates API clients from the OpenAPI spec, and builds all packages in the correct order. Run this whenever you pull new changes.

### Development Mode

```bash
npm run dev
```

Starts the backend and frontend with hot reload. The app runs in `development` mode by default, which seeds the database with test users (see [Getting Started](GETTING_STARTED.md#users)).

If you hit an "address in use" error, use `npm run dev:[1-5]` to pick a different stack.

### Running Multiple Stacks

Each stack has its own env file (`stack[1-5].env`) with isolated ports and a separate SQLite database:

```bash
npm run dev:1   # UI :2000, Legacy UI :2001, Backend :2003
npm run dev:2   # UI :2004, Legacy UI :2005, Backend :2006
npm run dev:3   # UI :2008, Legacy UI :2009, Backend :2010
npm run dev:4   # See stack4.env
npm run dev:5   # See stack5.env
```

You can also set `UI_PORT`, `LEGACY_UI_PORT`, and `BACKEND_PORT` env vars directly.

## After Making Changes

1. `npm run zero-to-prod` — verify everything compiles
2. `npm run test:e2e` — run end-to-end tests
3. `npm run dev` — verify the app starts and works

## Architecture

### Package Structure

```
apps/
├── backend/     # NestJS 11 API server (SQLite + TypeORM)
├── ui2/         # React 19 + Vite frontend (active development)
├── ui/          # DEPRECATED — only needs to compile
└── worker/      # AI agent workers (see apps/worker/README.md)
packages/
└── shared/      # Auto-generated types and API client from OpenAPI
```

All UI work goes in `apps/ui2`. The `apps/ui` package is deprecated.

### Layered Architecture

The backend follows strict layering:

```
Controller (HTTP/Transport) → Service (Business Logic) → Repository (Data)
```

Key principles:
- **Transport independence** — Services never import HTTP exceptions. They throw domain errors (e.g., `TaskNotFoundError`) that exception filters map to HTTP responses.
- **Thin controllers** — Controllers handle routing, validation, and DTO transformation. Business logic lives in services.
- **Type separation** — `dto/http/` for request/response DTOs, `dto/service/` for plain types, `errors/` for domain errors.

### API Generation Pipeline

The shared package auto-generates TypeScript types from the backend's OpenAPI spec:

1. Backend builds and outputs `openapi.json`
2. `openapi-typescript` generates types
3. `openapi-typescript-codegen` generates a fetch-based API client
4. Frontend imports these for type-safe API calls

This runs automatically as part of `npm run zero-to-prod`. No manual steps needed.

### Real-Time Communication

Socket.io WebSocket gateways per feature module. The agent workers use this to react to task events in real time.

## Key Technologies

- **Backend**: NestJS 11, TypeORM, SQLite, Socket.io, MCP SDK
- **Frontend**: React 19, Vite, React Router 7, Radix UI
- **Testing**: Jest (backend), Vitest (frontend)
- **Agents**: Claude Agent SDK, OpenCode SDK, Google ADK, GitHub Copilot SDK

## Backend Development

Follow the guides in `docs/architecture/` and `docs/review-guides/`:

- [Controller Responsibilities](architecture/controller-responsibilities.md)
- [Service Transport Independence](architecture/service-transport-independence.md)
- [DTO Mapping Patterns](architecture/dto-mapping-patterns.md)
- [Enum Management](architecture/enum-management.md)

## UI Development

For UI work, read `apps/ui2/CLAUDE.md` first. It covers styling (tokens.css), primitives, shell patterns, and feature structure.
