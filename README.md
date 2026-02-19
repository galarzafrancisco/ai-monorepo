# Taico

Taico is a task execution platform where humans and AI agents collaborate on work. It provides the primitives for creating tasks, assigning them to people or agents, and orchestrating automated workflows through status and tag triggers.

## Core Concepts

- **Tasks** — Units of work with an assignee (human or agent). Status changes trigger runtime events.
- **Agents** — AI workers that react to task events and execute work autonomously.
- **Threads** — Coordination layer for when tasks branch into parallel subtasks.
- **Context** — Addressable text blocks (instructions, docs, principles) that agents can discover and read.
- **Tools** — MCP servers with full OAuth 2.1 auth that agents can call.

Every action is access-controlled and attributable to an actor. See [Primitives](docs/PRIMITIVES.md) for the full model.

## Supported Agents

Taico ships with built-in support for:

- **[OpenCode](https://opencode.ai)** — Preferred runner. Supports any LLM provider.
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — Via the Claude Agent SDK.
- **[GitHub Copilot](https://github.com/features/copilot)** — Via the Copilot SDK.
- **[Google ADK](https://google.github.io/adk-docs/)** — Runs in-process, no external tools needed.

Adding support for a new runner is trivial — implement the runner interface and plug it in.

## Quick Start

```bash
npm run build:dev      # Install deps, generate API types, build all apps (dev-safe)
npm run dev:[1-5]      # Start backend + frontend with hot reload
```

## Prerequisites

- **Node.js 24+** — Required for all packages including worker builds
- npm 10+

## Guides

- **[Getting Started](docs/GETTING_STARTED.md)** — Create tasks, configure agents, and build workflows.
- **[Admin Guide](docs/ADMIN_GUIDE.md)** — User management, running workers, and system configuration.
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** — Development setup, architecture, API generation, and contributing.
- **[Agents Worker](apps/worker/README.md)** — How to run agent workers that execute tasks.

## Architecture at a Glance

```
apps/
├── backend/     # NestJS API server (SQLite + TypeORM)
├── ui2/         # React 19 + Vite frontend
├── ui/          # Deprecated — only needs to compile
└── worker/      # Agent worker processes
packages/
└── shared/      # Auto-generated types and API client from OpenAPI
```

The backend is the centralised brain (tasks, agents, database, auth). Agent workers are decoupled processes that can run anywhere — same machine, different machine, Kubernetes. They communicate with the backend via REST and WebSocket.

## Documentation

- `docs/PRIMITIVES.md` — Core domain model
- `docs/architecture/` — Architectural decisions and patterns
- `docs/review-guides/` — Code review checklists
- `docs/how-to-guides/` — Implementation guides
