# Admin Guide

This guide covers operating a Taico instance and the recommended way to run the server and worker.

## Recommended Topology

For a typical self-hosted setup:

- run the Taico server in Docker so it is stable and restarts automatically
- run the worker in Docker with explicit credential mounts so it is isolated and restarts automatically

The helper scripts in [`helpers/start-server.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-server.sh) and [`helpers/start-worker-docker.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-worker-docker.sh) reflect that setup.

## Server

Start the server with:

```bash
./helpers/start-server.sh
```

Before running it, review and adjust:

- `IMAGE`: keep the image tag current
- `PORT`: choose the port you want to expose
- `DATABASE_PATH`: point this at a persistent directory you control

The script runs the container with `--restart unless-stopped`, which is recommended so Taico comes back with the machine.

## First Login And Accounts

You no longer need a separate admin bootstrap script to create users.

When Taico starts for the first time, the app itself guides you through creating the first account. After that, sign in through the UI normally.

Any documentation or workflow that refers to manually creating users with a script is outdated.

## Worker

Build and start the Dockerized worker with:

```bash
npm run docker:worker:build
./helpers/start-worker-docker.sh
```

The helper runs the container with `--restart unless-stopped` and mounts the host credential directories needed for Taico worker OAuth, provider logins, `gh`, git, GitHub Copilot, OpenCode, and Claude. Review those mounts before using it on a shared machine.

For local development, you can still run:

```bash
npx @taico/worker --serverurl http://localhost:$PORT
```

That path gives the worker direct access to your:

- provider authentication
- developer toolchain
- shells and CLIs
- local repository access

That is powerful, but it is also a risk boundary. The Docker path keeps that boundary explicit by requiring credential and workspace mounts.

## Worker Authentication

The worker authenticates with the server and stores credentials locally. On first run it will guide you through browser-based authorization and then reuse stored credentials on later runs.

You do not need to provision a long-lived token per agent just to get the worker connected.

## Agents

Taico can come with agents pre-populated so a fresh instance is immediately usable.

Those agents are editable. Operators can change:

- prompts
- model/provider configuration
- triggers
- tool permissions

You can keep the defaults, adapt them, or replace them entirely.

## Projects And Repositories

Projects are associated to tasks through `project:slug` tags.

After a project exists, configure its repository in the UI. When a worker executes a task with that tag, it can prepare the workspace from that repository.

## Executions

Taico now uses **executions** as the runtime record for work claimed by workers.

If you see older documentation referring to agent runs or an orchestrator, treat that as historical language. The current model is:

- backend decides work eligibility
- worker claims work
- worker starts an execution
- execution activity and outcome are reported back to Taico

## Threads And Shared State

Threads are more than just grouping.

Each thread has a parent goal and a shared context block that acts as thread state. As attached tasks change, a middle-manager process extracts the thread-relevant information and reconciles it into that shared state so related agents can stay aligned.

## Security Notes

- Running the server in Docker is recommended for durability and isolation.
- Running the worker in Docker is recommended for isolation and automatic restart.
- Mount only the provider logins, repositories, shell access, and credentials the worker needs.
