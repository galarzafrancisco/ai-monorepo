# Taico Primitives

Taico is built around a small set of primitives that do not try to model life. They model execution. Everything else is composition.

If you understand these primitives, you understand the system.

## Task

A **Task** is the unit of work.

It has a clear **assignee** who is responsible for delivering it. That assignee can be a human or an agent. A task is not just a note or an idea. It is a commitment with an owner.

Discovery, decisions, and relevant context live inside the task as comments and attached context. The task is the living record of why the work exists, what has been tried, and what was decided.

Tasks have a status, and status is important because it is not just presentation. Status changes are runtime signals. A task becoming ready, in review, blocked, or done can trigger other behavior in the system.

Core properties:
- `id`
- `title`, `description`
- `assignee`
- `status`
- `tags`
- `createdAt`, `updatedAt`

## Comment

A **Comment** is the work log.

Comments are where people and agents capture:
- investigation and discovery
- decisions and tradeoffs
- evidence, links, and snippets
- progress updates
- results and summaries

The model is intentionally simple. The value comes from keeping the work log attached to the work itself.

## Agent

An **Agent** is something that can work on tasks.

An agent is two things:
1. a **harness** or runtime adapter, such as Claude Code, OpenCode, ADK, or Copilot
2. an **LLM configuration + prompt** that defines how it behaves

Agents do not work in the abstract. They work on tasks. The task is the contract; the agent is the worker.

Agents can read context, write comments, create subtasks, open pull requests, and call tools, but always through access-controlled interfaces.

Taico ships with some agents pre-populated so a new instance is usable immediately. They are starting points, not locked system roles. Users can edit them or replace them entirely.

## Context Block

A **Context Block** is an addressable unit of text.

Context Blocks can be:
- created from anywhere
- referenced by id
- attached to tasks, threads, and other surfaces
- reused over time
- edited as knowledge evolves

They are not documents in the heavyweight sense. They are reusable pieces of context.

Core properties:
- `id`
- `title`
- `body`
- `tags`
- attachment references

## Thread

A **Thread** is coordination.

A thread exists when work branches into multiple related tasks that need to move in parallel while still contributing to one higher-level goal.

A thread contains:
- a primary task
- related tasks
- shared thread state
- a shared coordination surface for discoveries that matter across the branch

Every thread has a shared context block that acts as thread state. As tasks attached to the thread are updated, a middle-manager process extracts the information that matters at the thread level and reconciles it into that shared state.

Agents executing tasks inside the thread are aware that:
- they are contributing to a larger parent goal
- there is shared thread context they should read and respect
- their work may change the thread-level state seen by other tasks in the thread

When an agent creates subtasks, Taico can automatically create or extend a thread so the work stays aligned without forcing everything into one chat transcript.

## Execution

An **Execution** is the runtime record for a worker actively working a task.

Executions replace the old agent-run concept. The execution is the first-class runtime identity for work happening now and for the history of what happened.

An execution links:
- the task being worked
- the assigned agent
- the worker session that claimed the work
- runtime state such as queued, active, completed, failed, or stopped
- execution-scoped activity and artifacts

Executions matter because the same agent can work on the same task multiple times over the task's lifetime. Execution history gives traceability: what happened, when, and under which runtime context.

## Worker Runtime

Agents execute in the **worker runtime**. This is runtime infrastructure, not a separate domain primitive.

The worker:
- authenticates with the Taico server
- claims eligible work from the execution queue
- creates and updates active executions
- prepares a clean workspace when needed
- launches the configured agent harness
- reports execution activity back to the server

If a task is tagged with a project that has a repository configured, the worker can clone that repository into the workspace before running the agent. This keeps code-focused work isolated and reproducible.

## Tags

Tags are lightweight metadata.

They exist to:
- filter
- group
- route
- trigger simple behavior

Taico uses tags heavily because they stay flexible longer than adding new entity types too early.

## Project

A **Project** is metadata attached to a `project:slug` tag.

Projects exist because some groups of tasks need shared runtime context such as:
- a repository URL
- workspace defaults
- tool defaults
- conventions

The key idea is that a project is not a heavyweight container. It is a tag plus metadata that can travel with tasks.

When a task has a `project:slug` tag, the worker can use the corresponding project metadata to prepare the right workspace before execution starts.

## Authorization And Actors

Everything is access-controlled.

Every action is attributable to an **actor**: a human user, an agent identity, or a system identity. The authorization server issues tokens and gates access through scopes across REST, WebSocket, and MCP.

There are no anonymous actions. That is what keeps the system auditable and safe.

## Doors

Taico exposes three doors into the same system:

1. **REST API**
2. **WebSocket**
3. **MCP (Model Context Protocol)**

The primitives are the same underneath. Only the interface changes.

## Scopes

Every feature area has scopes.

Scopes are the common access-control mechanism across all three doors. If an actor can do something through one interface, the same permissions model should apply through the others.

## Tools

Tools are capabilities that agents can call.

Taico allows MCP servers to be registered as tools and brokers access to them through scoped identities and OAuth-based flows where needed.

Agents do not get raw unrestricted access to every system by default. Tool access is explicit and attributable.

## How The Pieces Fit Together

A typical flow looks like this:

- A human creates a task and assigns it to themselves or to an agent.
- The task status changes into a state that makes it eligible for work.
- The backend places the task into the execution queue.
- A worker claims the task and starts an execution.
- The worker prepares a workspace, including cloning a project repository when needed.
- The agent works on the task and writes progress back as comments and artifacts.
- If the work branches, the agent creates subtasks and Taico links them through a thread.
- Thread-level state is continuously reconciled so related tasks can see the parent goal and shared context.
- Each related task can be executed independently while still sharing coordination context.

That is the system: simple primitives and an execution-oriented runtime.
