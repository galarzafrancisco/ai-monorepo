# Getting Started

This guide walks you through using Taico as an end user — creating tasks, configuring agents, and building workflows.

## Logging In

When you first open Taico, you'll be greeted with a login screen. Enter your email and password to get in. If you don't have an account, ask your administrator to create one for you (see the [Admin Guide](ADMIN_GUIDE.md)).

## Tasks

Tasks are the core unit of work. To create one:

1. Go to **Tasks** from the main navigation.
2. Click **Create Task** and provide a title and description.
3. Assign it to yourself, another user, or an agent.

As a task progresses, you'll see live activity in the UI — comments, status changes, and artefacts created by whoever is working on it.

### Status

Tasks move through statuses like `NOT_STARTED`, `IN_PROGRESS`, `IN_REVIEW`, and `DONE`. Status changes are events that the system reacts to — this is how agents know when to pick up work.

### Tags

Tags are metadata labels. Add them to tasks for filtering and organisation.

Some tags have special behaviour:

- **`project:xyz`** — Links the task to a project. If the project doesn't exist, it is created automatically when you add the tag. This is the only way to create projects.

### Artefacts

Tasks can produce artefacts as work progresses. A common one is a Pull Request, but it could be anything. Artefacts are manifested as links and appear at the top of the task.

### Dependencies

Tasks can depend on other tasks. When dependencies are set, a task won't be worked on until its dependencies are complete. (Note: dependency management is not yet available in the UI or worker — coming soon.)

### Ask for Help

Tasks have the ability to ask for help — either from a human or from another agent. Agents running in headless mode are encouraged to ask for help when they're stuck. A task that needs help is highlighted in the UI so you can't miss it.

## Projects

A project groups related tasks and links them to a git repository.

To set up a project:

1. **Create it** by adding a `project:your-project-name` tag to any task.
2. **Configure it** by going to **Settings > Projects**. Find your project and add a git repo URL.

When an agent picks up a task tagged with a project, the worker clones the repository into a clean workspace. This is how agents know which codebase to work on.

> **Important:** If you want an agent to work on a repository, you **must** tag the task with `project:your-project`. Without it, the agent starts in an empty folder — it will get confused, or worse, roam through your file system looking for code that isn't there.

## Agents

Agents are AI workers that execute tasks autonomously. Each agent has:

- **System prompt** — Instructions that define what the agent does and how it behaves. This is where you tell it your conventions, how to move tasks around, and what to do when it's done.
- **Status triggers** — Which task statuses the agent reacts to. A coding agent might trigger on `NOT_STARTED`, a reviewer on `IN_REVIEW`.
- **Tag triggers** — Additional filters based on task tags, for more expressive routing.
- **Agent type** — Which AI runtime executes the agent (Claude, OpenCode, ADK, GitHub Copilot).

The app comes with a couple of pre-populated agents to get you started. You can edit them or create your own from the **Agents** page.

### How Agents Pick Up Work

An agent picks up a task when:

1. The task's status matches one of the agent's status triggers.
2. The task is assigned to that agent (or the agent is configured to pick up unassigned tasks matching its triggers).
3. If the agent has tag triggers, the task must also match those.

Once triggered, the agent works autonomously — reading the task, making progress, posting comments, and eventually moving the task to the next status.

> **Caution:** Agents are started with access to a shell on the worker machine. In theory, they can do anything your machine can do. Run workers on machines you're comfortable giving that level of access to, and be mindful of what tools and credentials are available on the host.

## Threads

When an agent working on a task decides to break it down into subtasks, Taico detects this automatically and creates a **thread**. A thread collects all subtasks that are working together towards a single parent task.

Tasks triggered from a thread get additional context — they know they're part of a bigger goal. A background coordinator in the thread watches updates from individual tasks and pulls relevant context into the shared thread state.

This is how you get "many agents, one mission" without pretending they're all in the same chat window.

## Context

Context blocks are pages of markdown content — instructions, principles, supporting documentation. You can create them and attach them to tasks, threads, or projects.

Agents can discover and read context as they work. Think of context blocks as shared knowledge that informs how agents approach their tasks.

## Tools

Tools are external capabilities that agents can call. The built-in tools let agents interact with Taico itself (read/write tasks, context, create subtasks). Additional tools can be registered by your administrator.

## Example Workflow

A workflow that works well out of the box:

1. **Set up two agents**: a **coder** (triggers on `NOT_STARTED`) and a **reviewer** (triggers on `IN_REVIEW`). Ask your admin to start workers for both.
2. **Create a task**, tag it with the right `project:` tag. This is important — it links the task to the repo the agent will work on.
3. The coder agent picks it up and moves it to `IN_PROGRESS`. You'll see live activity in the UI.
4. When done, the coder moves the task to `IN_REVIEW` and assigns it to the reviewer.
5. The reviewer picks it up. If all good, it approves and assigns back. If changes are needed, it comments and moves the task back to `NOT_STARTED`, reassigning to the original coder.
6. The coder picks it up again, addresses the feedback, and the cycle continues.

The key insight: your tools are **status triggers** and **tag triggers**. You define the workflow by telling agents (via their system prompts) how to move tasks around. Get creative — you can build review loops, planning workflows, multi-agent pipelines, whatever fits your process.
