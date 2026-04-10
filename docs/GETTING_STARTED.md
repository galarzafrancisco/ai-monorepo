# Getting Started

This guide walks through the recommended user-facing path for running and using Taico.

## Recommended Setup

For most people, the best setup is:

1. Run the Taico server in Docker so it is always available and restarts with your machine.
2. Run the worker locally via `npx` so it can use the tools, CLIs, and provider logins you already have on your machine.

Helper scripts for both live in [`helpers/start-server.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-server.sh) and [`helpers/start-worker.sh`](/Users/franciscogalarza/github/ai-monorepo/helpers/start-worker.sh).

## Start The Server

Use the helper script:

```bash
./helpers/start-server.sh
```

Before running it, review the variables at the top of the script:

- `IMAGE`: keep this updated to the image tag you want to run
- `PORT`: the local port the app will use
- `DATABASE_PATH`: set this to a stable location on your machine so your data persists where you expect it

The script starts the server in Docker with `--restart unless-stopped`, which is the recommended default for a personal or small-team instance.

## Create Your First Account

Open the app in your browser after the server starts.

On first startup, Taico guides you through creating the first account inside the app itself. You do not need to run any admin bootstrap script.

## Start The Worker

Use the helper script:

```bash
./helpers/start-worker.sh
```

The recommended way to run the worker is via `npx` on your local machine. That gives the worker direct access to:

- your local toolchain
- your authenticated provider CLIs and SDKs
- repositories and developer tools already available on your machine

That convenience cuts both ways. The worker is powerful, and the agents it launches can act with the capabilities available on the host. Only run it on a machine you trust for that level of access.

If you plan to use Google models via ADK, set the Google environment variables in the helper script before starting it.

## Logging In

Once the server is running, open Taico in the browser and sign in with the account you created during onboarding.

After login, the app will walk you through the basics the first time.

## Agents

Taico usually comes with some agents pre-populated so you can get started quickly. Treat them as defaults, not fixed system roles.

You can:

- edit the built-in agents
- change their prompts, models, triggers, and tools
- create your own agents from scratch

## Tasks

Tasks are the core unit of work.

To create one:

1. Go to **Tasks**.
2. Create a task with a clear title and description.
3. Assign it to yourself or to an agent.

As work progresses, comments, status changes, and artifacts accumulate on the task itself.

### Status

Statuses are operational, not just cosmetic. They are part of how work becomes eligible for execution.

### Tags

Tags are lightweight metadata used for filtering, routing, and project association.

### Artifacts

Tasks can accumulate links and outputs such as pull requests or other deliverables.

## Projects

Projects are created by adding a `project:slug` tag to a task.

After the project exists, configure its repository from the UI. When a worker executes a task with that project tag, it can prepare the workspace against that repository.

If you want an agent to work in a codebase, tagging the task with the right `project:slug` matters. Without that, the worker starts in a generic workspace.

## Executions

When a task becomes eligible and a worker claims it, Taico creates an **execution**.

Executions replace the old agent-run model. They are the runtime record of work being picked up, performed, and completed by the worker.

## Threads

When work branches into subtasks, Taico uses threads to keep related tasks coordinated without forcing them into one transcript.

Each thread has a parent goal and a shared context block. A middle-manager process watches updates from the tasks attached to that thread and pulls the relevant information into that shared thread state.

Agents executing tasks in a thread are aware that they are part of a larger goal and that there is shared thread context they should use while working.

This is how multiple people or agents can work toward one goal while still sharing the important context.

## Context And Tools

Context blocks hold reusable instructions and reference material.

Tools are MCP servers that agents can call through Taico's authorization model. Built-in tools let agents operate on Taico itself, and more tools can be added over time.

## Simple Workflow

A practical flow looks like this:

1. Start the server with Docker.
2. Create your first account in-app.
3. Start the worker locally with `npx`.
4. Review the pre-populated agents and adjust them as needed.
5. Create a task and assign it to an agent.
6. Add a `project:slug` tag if the task should run against a repository.
7. Watch the task comments and execution activity as the worker picks it up.
