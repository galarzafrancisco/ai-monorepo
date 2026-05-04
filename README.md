# Taico

Taico is a task execution platform where humans and AI agents collaborate on work.

It is built around tasks, threads, context, tools, and executions. The goal is to make AI-assisted work visible, attributable, reviewable, and easier to coordinate.

## Core Concepts

- **Tasks**: Units of work with a clear assignee.
- **Agents**: Configurable AI workers that operate on tasks.
- **Executions**: Runtime records for work claimed and performed by workers.
- **Threads**: Coordination when work branches into related tasks, with shared thread state reconciled from task updates.
- **Context**: Addressable text blocks that can be attached and reused.
- **Tools**: MCP servers agents can call through Taico's auth model.
- **Actors**: Humans, agents, and workers. Every action in Taico is attributable to an actor.

See [`docs/PRIMITIVES.md`](docs/PRIMITIVES.md) for the domain model.

## Supported Runtimes

Taico supports:

- [OpenCode](https://opencode.ai)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub Copilot](https://github.com/features/copilot)
- [Google ADK](https://google.github.io/adk-docs/)

## Recommended Startup Path

### 1. Start the server

This starts a Taico server in a local container on your machine.

```bash
curl -fsSL https://raw.githubusercontent.com/galarzafrancisco/ai-monorepo/refs/heads/main/helpers/start-server.sh | bash
```

The server script is meant to be long-lived and restart with your machine.

### 2. Open the app

Open [http://localhost:9999](http://localhost:9999), create your first account, and follow the onboarding flow.

## Development

```bash
npm run build:dev
npm run dev:[1-5]
```

## Guides

- [Getting Started](docs/GETTING_STARTED.md): recommended user-facing setup and first workflow
- [Admin Guide](docs/ADMIN_GUIDE.md): running the server and worker safely
- [Developer Guide](docs/DEVELOPER_GUIDE.md): local development and architecture
- [Worker README](apps/worker/README.md): worker runtime details
- [Deployment Guide](docs/DEPLOYMENT.md): Kubernetes and GitOps deployment

## Architecture At A Glance

```text
apps/
├── backend/          # NestJS API server
├── llm-benchmarker/  # LLM benchmark and evaluation tooling
├── ui/               # Active React frontend
├── ui-v1/            # Deprecated frontend, compile-only
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

At runtime, the backend owns tasks, threads, auth, and execution lifecycle. Workers connect to the backend, claim work, and execute agents in isolated workspaces.

`ui` is the active product UI, `worker` is the current runtime, and `worker-v1` / `ui-v1` are legacy surfaces kept for compatibility and migration.

## License

Taico is source-available.

Taico is licensed under [PolyForm-Small-Business-1.0.0](LICENSE).

It is free to use for individuals, personal projects, research, education, and qualifying small businesses.

Use by larger organisations requires a separate commercial license. See [COMMERCIAL.md](COMMERCIAL.md).
