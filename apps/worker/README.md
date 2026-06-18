# @taico/worker

Runtime for the current Taico worker.

The worker connects to an existing Taico server, claims eligible work, starts executions, prepares workspaces, and launches the configured agent runtime.

## Start

```bash
npx @taico/worker --serverurl http://localhost:1234
```

The helper script [`helpers/start-worker.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-worker.sh) wraps this for the common local setup.

## Docker

Build the worker image with:

```bash
npm run docker:worker:build
```

Start it with Docker restart supervision:

```bash
./helpers/start-worker-docker.sh
```

The container starts the worker with `--no-startup-retry`. If it cannot connect during startup, the process exits and Docker restarts it according to `--restart unless-stopped`.

The image includes Node, Python, build tools, git, gh, OpenSSH, OpenCode, Claude Code, and GitHub Copilot CLIs. Provider and CLI authentication are intentionally not baked into the image; mount the host credential directories you want the worker to use.

Default container paths:

- worker credentials: `/home/taico/.taico/worker-credentials.json`
- workspaces: `/home/taico/.taico/workspaces`

The helper mounts common credential locations for Taico, gh, git/SSH, GitHub Copilot, OpenCode, and Claude. Review those mounts before running it on a shared machine.

The helper also mounts a dedicated host-owned Docker home at `~/.taico/docker-home` by default. This gives CLIs writable cache and runtime state paths such as `/home/taico/.cache` without mounting your full host home into the container. Override it with `TAICO_DOCKER_HOME` if needed.

Smoke-check the image and helper mount shape with:

```bash
npm run docker:worker:smoke
```

## Recommended Usage

For the smallest trust boundary, run the worker in Docker and mount only the credentials and directories it needs. Running locally via `npx` is still useful while developing the worker or when you need unrestricted access to your host toolchain.

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
