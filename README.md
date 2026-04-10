# Taico

Taico is a task execution platform where humans and AI agents collaborate on work. It is built around tasks, threads, context, tools, and executions.

## Core Concepts

- **Tasks**: Units of work with a clear assignee.
- **Agents**: Configurable AI workers that operate on tasks.
- **Executions**: Runtime records for work claimed and performed by workers.
- **Threads**: Coordination when work branches into related tasks, with shared thread state reconciled from task updates.
- **Context**: Addressable text blocks that can be attached and reused.
- **Tools**: MCP servers agents can call through Taico's auth model.

Every action is attributable to an actor. See [`docs/PRIMITIVES.md`](/Users/franciscogalarza/github/ai-monorepo/docs/PRIMITIVES.md) for the domain model.

## Supported Runtimes

Taico supports:

- [OpenCode](https://opencode.ai)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub Copilot](https://github.com/features/copilot)
- [Google ADK](https://google.github.io/adk-docs/)

## Recommended Startup Path

For most users:

1. Run the server in Docker with [`helpers/start-server.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-server.sh).
2. Run the worker locally via `npx` with [`helpers/start-worker.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-worker.sh).
3. Open the app and create your first account through the onboarding flow.
4. Review the pre-populated agents and customize them as needed.

The server script is meant to be long-lived and restart with your machine. The worker script is meant to run where your provider auth and local toolchain already exist.

## Development

```bash
npm run build:dev
npm run dev:[1-5]
```

## Guides

- [Getting Started](/Users/franciscogalarza/github/ai-monorepo/docs/GETTING_STARTED.md): recommended user-facing setup and first workflow
- [Admin Guide](/Users/franciscogalarza/github/ai-monorepo/docs/ADMIN_GUIDE.md): running the server and worker safely
- [Developer Guide](/Users/franciscogalarza/github/ai-monorepo/docs/DEVELOPER_GUIDE.md): local development and architecture
- [Worker README](/Users/franciscogalarza/github/ai-monorepo/apps/worker/README.md): worker runtime details
- [Deployment Guide](/Users/franciscogalarza/github/ai-monorepo/docs/DEPLOYMENT.md): Kubernetes and GitOps deployment

## Architecture At A Glance

```text
apps/
├── agent-api/        # Agent-facing API service
├── backend/          # NestJS API server
├── llm-benchmarker/  # LLM benchmark and evaluation tooling
├── ui2/              # Active React frontend
├── ui/               # Deprecated frontend, compile-only
├── worker/           # Current worker runtime
└── worker-v1/        # Legacy worker runtime
packages/
├── adk-session-store/  # SQLite-backed Google ADK session store
├── client/             # Generated TypeScript API client
├── errors/             # Shared error classes and codes
├── events/             # Shared realtime event contracts
├── openapi-sdkgen/     # OpenAPI SDK generation tooling
└── shared/             # Shared contracts and generated artifacts
```

At runtime, the backend owns tasks, threads, auth, and execution lifecycle. Workers connect to it, claim work, and execute agents in isolated workspaces. `ui2` is the active product UI, `worker` is the current runtime, and `worker-v1`/`ui` are legacy surfaces kept for compatibility and migration.
