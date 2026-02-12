# Admin Guide

This guide covers operating a Taico instance — user management, running agent workers, and system configuration.

## Environments

Taico has two modes, controlled by the `NODE_ENV` environment variable:

### Development

Set `NODE_ENV=development` (the default). The database is seeded with two test users:

| Email | Password | Role |
|---|---|---|
| `dev@test.com` | `dev` | Developer |
| `admin@test.com` | `admin` | Admin |

These are for testing only. Do not use them in production.

### Production

Set `NODE_ENV=production`. No users are seeded. You must create the first admin user manually.

## User Management

There is no self-service user creation yet. To create an admin user:

**Kubernetes:**
```bash
kubectl -n taico exec -it deployment/taico -- node apps/backend/dist/scripts/create-admin-user.js
```

**Running locally:**
```bash
npm -w apps/backend run create-admin
```

Both commands prompt you interactively for email and password.

## Running Agent Workers

The Taico backend manages tasks, agents, and the UI. But agents don't execute on the backend — they run in separate **worker** processes. This is intentional: the backend is centralised, workers are distributed.

You can run workers on the same machine as the backend, on a different server, or in Kubernetes. Each worker represents one agent. To run multiple agents, start multiple workers.

### Worker Setup

Full instructions are in [apps/agents/README.md](../apps/agents/README.md). The short version:

1. **Create an agent** in the UI (or use a pre-populated one). Configure its system prompt, agent type, and triggers.
2. **Create an access token** from the agent's page. The token needs scopes: `task:*`, `meta:*`, `context:*`, `agents:read`, `mcp:use`.
3. **Configure a `.env` file** for the worker:
   ```env
   AGENT_SLUG="claude"
   BASE_URL="http://localhost:2000"
   ACCESS_TOKEN="your-token-here"
   WORK_DIR="/absolute/path/to/workspace"
   ```
4. **Start the worker:**
   ```bash
   npm -w apps/agents run start
   ```

### Running Multiple Workers

Create a separate `.env` file per agent (e.g., `.env.claude`, `.env.reviewer`) and start each worker with the corresponding env file.

### Supported Agent Types

| Type | Runtime | Host Requirements |
|---|---|---|
| `claude` | Claude Agent SDK | Claude Code installed and authenticated |
| `opencode` | OpenCode SDK | OpenCode installed. Preferred for flexibility — supports multiple LLM providers. |
| `adk` | Google ADK | None (runs in-process). No tools — suited for general tasks like reading the board. |
| `githubcopilot` | GitHub Copilot SDK | GitHub Copilot set up on the machine |

Workers have access to whatever is on the host machine. If Claude Code is installed and logged in, the `claude` runner can use it. Same for OpenCode and GitHub Copilot.

### A Note on Access Tokens

The current token-based authentication for workers is a temporary solution. The UI for creating and copying tokens is deliberately minimal because this flow will be replaced. Eventually, workers will be able to securely impersonate agents automatically — no manual token management needed. For now, you copy-paste tokens from the UI.

## Projects and Repositories

Projects are created by users when they add a `project:slug` tag to a task. As an admin, you configure projects by going to **Settings > Projects** and adding the git repository URL.

When a worker picks up a task tagged with a project, it clones the repo into a clean workspace before the agent starts working.

## Tools and MCP Servers

Tools are MCP servers that agents can call. Every agent has an identity, every action is traceable, and tool access is gated by scopes via the built-in authorization server.

Built-in tools let agents interact with Taico (tasks, context). The backend supports registering additional MCP servers, but there's no UI for this yet.

### OAuth Token Bridge

For MCP servers that authenticate against downstream systems (Google Cloud, Slack, etc.), Taico supports the OAuth token bridge pattern. The backend handles token exchange so agents get scoped access to external services without holding raw credentials. A UI for managing this is planned.

### Authorization Model

Under the hood, Taico runs a full OAuth 2.1 authorization server. Every agent has an identity. Every action performed through any interface (REST, WebSocket, MCP) is attributable to an actor. Access control is granular: you can define which actor can use which tool with which permissions. This infrastructure is in place even though the admin UI for it is still coming.
