# Admin Guide

This guide covers operating a Taico instance — user management, running agent workers, and system configuration.

## Quick Start via npx

The fastest way to get Taico running. No cloning required — just npm packages.

### 1. Start the server

```bash
npx -y @taico/taico
```

By default the server runs in **development mode**, which seeds the database with test users (see [Environments](#environments) below). This is convenient for getting started, but development mode assumes the backend is being proxied by Vite on a separate port. Since there's no Vite proxy when running via npx, you need to tell the server its own URL explicitly:

```bash
BACKEND_PORT=3000 ISSUER_URL=http://localhost:3000 npx -y @taico/taico
```

`BACKEND_PORT` and `ISSUER_URL` must be consistent — the issuer URL is the base URL that the OAuth/OIDC server advertises, and it must match the port the server is actually listening on. If they don't match, login will fail.

Open `http://localhost:3000` in your browser.

### 2. Start a worker

Workers connect to the server and run AI agents on tasks. Each worker represents one agent.

Create the agent in the UI and generate an access token (Agents > your agent > Create Token). The token needs scopes: `task:*`, `meta:*`, `context:*`, `agents:read`, `mcp:use`.

Create a `.env` file:

```env
AGENT_SLUG=claude
BASE_URL=http://localhost:3000
ACCESS_TOKEN=your-token-here
WORK_DIR=/absolute/path/to/workdir
```

Then start the worker:

```bash
npx -y @taico/worker
```

To run multiple agents, create a `.env` file per agent and start each in its own terminal:

```bash
# Terminal 1
env $(cat .env.claude | xargs) npx -y @taico/worker

# Terminal 2
env $(cat .env.reviewer | xargs) npx -y @taico/worker
```

## Environments

Taico has two modes, controlled by the `NODE_ENV` environment variable:

### Production (Default)

Production mode is the default when `NODE_ENV` is not set. This ensures `npx @taico/taico` works out of the box. No users are seeded. On first startup, if no admin exists, Taico prompts you to create the first admin user through onboarding.

`ISSUER_URL` defaults to `http://localhost:<UI_PORT>` (default 2000) for ease of use. Serious production deployments should set `ISSUER_URL` explicitly to match the public URL.

### Development

Set `NODE_ENV=development` to enable development mode. The database is seeded with two test users:

| Email | Password | Role |
|---|---|---|
| `dev@test.com` | `dev` | Developer |
| `admin@test.com` | `admin` | Admin |

These are for testing only. Do not use them in production.

## User Management

There is no self-service user creation yet. The first admin is created through onboarding. To create additional admin users:

**Kubernetes:**
```bash
kubectl -n taico exec -it deployment/taico -- node apps/backend/dist/scripts/create-admin-user.js
```

**Running locally (from the monorepo):**
```bash
npm -w apps/backend run create-admin
```

Both commands prompt you interactively for email and password.

## Running Agent Workers

The Taico backend manages tasks, agents, and the UI. But agents don't execute on the backend — they run in separate **worker** processes. This is intentional: the backend is centralised, workers are distributed.

You can run workers on the same machine as the backend, on a different server, or in Kubernetes. Each worker represents one agent. To run multiple agents, start multiple workers.

### Worker Setup

If you're using the npm packages, see [Quick Start via npx](#quick-start-via-npx) above.

If you're running from the monorepo, full instructions are in [apps/worker/README.md](../apps/worker/README.md). The short version:

1. **Create an agent** in the UI (or use a pre-populated one). Configure its system prompt, agent type, and triggers.
2. **Create an access token** from the agent's page. The token needs scopes: `task:*`, `meta:*`, `context:*`, `agents:read`, `mcp:use`.
3. **Configure a `.env` file** for the worker:
   ```env
   AGENT_SLUG="claude"
   BASE_URL="http://localhost:3000"
   ACCESS_TOKEN="your-token-here"
   WORK_DIR="/absolute/path/to/workspace"
   ```
4. **Start the worker:**
   ```bash
   npm -w apps/worker run start
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
