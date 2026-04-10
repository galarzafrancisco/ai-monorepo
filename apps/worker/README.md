# @taico/worker

Runtime for the current Taico worker.

The worker connects to an existing Taico server, claims eligible work, starts executions, prepares workspaces, and launches the configured agent runtime.

## Start

```bash
npx @taico/worker --serverurl http://localhost:1234
```

The helper script [`helpers/start-worker.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-worker.sh) wraps this for the common local setup.

## Recommended Usage

The recommended way to run the worker is locally via `npx`.

That lets it use:

- your existing provider logins
- your local developer tools
- your local shell environment
- any CLIs already configured on the machine

That is convenient, but it also means the worker inherits real host capabilities. Run it only on a machine you trust for that level of access.

## Authentication

On first startup, the worker performs browser-based authorization against the Taico server and stores credentials locally. After that it refreshes and reuses those credentials automatically.

Default credentials path:

- `~/.taico/worker-credentials.json`

Default workspace root:

- `~/.taico/workspaces`

## Options

- `--serverurl`: required Taico server base URL
- `--credentials-path`: override the stored worker credentials path
- `--working-directory`: override the workspace root used for task workspaces

## Supported Agent Runtimes

- GitHub Copilot
- OpenCode
- Google ADK
- Claude

For OpenCode, GitHub Copilot, and Claude, the worker uses whatever local installation and authentication state already exists on the host.

## Google ADK

If you want to use Google models via ADK, set:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="your-location"
export GOOGLE_GENAI_USE_VERTEXAI="True"
```

The helper script includes placeholders for those variables.

## Runtime Model

This worker is execution-centric.

- the backend decides which tasks are eligible
- the worker claims work
- the worker starts an execution
- the worker requests short-lived agent execution tokens as needed
- execution activity is reported back to Taico

If you see old docs referring to an orchestrator or agent runs, that is legacy terminology.
