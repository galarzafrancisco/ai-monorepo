# Taico Agent Worker

This is the agent worker process. It connects to the Taico backend, listens for task events, and executes AI agents in isolated workspaces.

## How It Works

The worker is a Node.js process that:

1. Connects to the backend via REST API and WebSocket.
2. Listens for task events that match the agent's status and tag triggers.
3. Runs a heartbeat reconcile loop that polls recent tasks and re-evaluates readiness.
4. When a matching task appears, it clones the project's git repo (if configured) into a clean workspace.
5. Spins up the appropriate agent harness (Claude, OpenCode, ADK, or GitHub Copilot).
6. The agent works on the task, posting comments and status updates back to the backend.

## Architecture

The worker is intentionally decoupled from the backend. You can run workers anywhere — same machine, a different server, or in Kubernetes. Each worker represents one agent. To run multiple agents, start multiple worker processes.

The worker has access to whatever the host machine has access to. If you have Claude Code installed and authenticated, the Claude runner can use it. Same for OpenCode and GitHub Copilot.

## Design Constraints (Aspirational)

These are the intended design constraints for the worker runtime. They are not implemented yet.
Today the worker just runs a Claude Code, OpenCode, or GitHub Copilot process on your machine and can do whatever that process can do.
This early version requires you to be authenticated to tools, which means you are exposing keys to the LLM. Treat it with caution.

1. The shell is disposable.
The agent may destroy its own environment and nothing outside it is affected.

2. The shell has zero ambient authority.
No credentials, no identities, no implicit cloud access, no inherited power.

3. Authority is external.
All cost-bearing or state-changing actions are mediated by a trusted service.

4. The agent cannot gain power by exploration.
Scanning the filesystem, env, or network must not reveal new capabilities.

5. Capabilities are explicit and task-scoped.
If a task needs power, it must be declared up front and granted narrowly.

## Setup

### 1. Create an Agent

In the Taico UI, go to **Agents** and create one (or use a pre-populated agent). Configure its system prompt, agent type, and status/tag triggers.

### 2. Create an Access Token

From the agent's page in the UI, create an access token. The token needs at least these scopes: `task:*`, `meta:*`, `context:*`, `agents:read`, `mcp:use`.

> **Note:** Token-based auth is a temporary solution. Eventually, workers will securely impersonate agents automatically — no manual token management needed. The UI is intentionally minimal because this flow will be replaced.

### 3. Configure the Worker

Create a `.env` file in this directory (one per agent). See `.env.example`:

```env
AGENT_SLUG="claude"                          # Which agent this worker represents
BASE_URL="http://localhost:2000"             # URL where the backend is running
ACCESS_TOKEN="your-token-here"               # Token created in step 2
WORK_DIR="/absolute/path/to/workspace"       # Folder where work happens (absolute path)
HEARTBEAT_INTERVAL_MS="60000"                # Optional: heartbeat interval (ms)
HEARTBEAT_TASK_LIMIT="100"                   # Optional: tasks reconciled per heartbeat
```

### 4. Start the Worker

```bash
npm -w apps/worker run start
```

To run multiple agents, create separate `.env` files (e.g., `.env.claude`, `.env.reviewer`) and start each worker with the appropriate env file loaded.

## Supported Agent Types

| Type | Harness | Requirements |
|---|---|---|
| `claude` | Claude Agent SDK | Claude Code installed and authenticated |
| `opencode` | OpenCode SDK | OpenCode installed |
| `adk` | Google ADK | None (runs in-process). No tools — suited for general tasks like reading the board. |
| `githubcopilot` | GitHub Copilot SDK | GitHub Copilot set up on the machine |

## MCP Integration

Each agent run gets access to a Taico MCP server at the backend's `/api/v1/tasks/tasks/mcp` endpoint. This gives agents tools to interact with Taico — reading tasks, posting comments, creating subtasks, etc. Authentication is handled automatically via the access token and a per-run ID header.
