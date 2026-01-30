# Taico Primitives

Taico is built around a small set of primitives that don't try to "model life". They model execution. Everything else is composition.

If you understand these primitives, you understand the system.

---

## Task

A **Task** is the unit of work.

It has a clear **assignee** (human or agent) who is responsible for delivering it. A task is not "a note" or "an idea". It's a commitment with an owner.

**Discovery, decisions, and relevant information live inside the task** as comments. The task is the living record of *why we're doing this*, *what we tried*, and *what we decided* — in the same place as the work.

Tasks have a **status** (and potentially other fields like priority, due date, etc.), but status is special because it can act as a **trigger**. Changing a status is not only a UI thing; it's an event the runtime can react to.

**Core properties**
- `id`
- `title`, `description`
- `assignee` (actor id)
- `status`
- `tags`
- `createdAt`, `updatedAt`

---

## Comment

A **Comment** is the work log and brain trail.

Comments are where you capture:
- investigation / discovery
- decisions and tradeoffs
- links, snippets, evidence
- progress updates
- agent output and results

The model is simple on purpose: the intelligence is in *how we use it*.

---

## Agent

An **Agent** is something that can act on tasks to get work done.

An agent is **two things**:
1) a **harness** (the execution environment / adapter) — e.g. opencode, claudecode, ADK
2) an **LLM + prompt** (and config) that defines how it behaves

Agents don't "work in the abstract". They work on tasks. The task is the contract, and the agent is the worker.

Agents can read context, create comments, create subtasks, propose diffs, open PRs, call tools, etc — but always through access-controlled interfaces.

---

## Context Block

**Context is text**, but the important part is *how it's created, managed, referenced, and attached*.

A **Context Block** is the primitive. It's an addressable unit of text that can be:
- created from anywhere
- referenced by id
- attached to tasks/threads/projects
- reused across time
- edited (with history if we want)

Context Blocks are not "documents" in the Confluence sense. They're building blocks.

**Core properties**
- `id`
- `title` (optional)
- `body` (markdown/plain text)
- `tags`
- attachment references (what it's linked to)

---

## Thread

A **Thread** is coordination.

A thread exists when a task branches into multiple tasks that need parallel progress while still staying aligned to a higher goal. Threads are the "shared room" where agents can publish information that might matter to the overall objective.

A thread contains:
- a **primary task** (the goal / root)
- all **related tasks** (spawned or linked)
- shared **thread context** (optional)
- a feed of **thread-level commentary** (optional), but mostly it's a container that links the work

### Auto-threading (branch-out detection)

When an agent working on a task decides to create subtasks (which is basically how we do sub-agents), the system detects this as a **branch-out** and automatically creates a thread if one doesn't exist.

Each task is worked independently by an agent (or human), but the thread gives a place to:
- share discoveries upstream
- avoid duplicated work
- keep the primary task from becoming a dumping ground

Threads are how you get "many agents, one mission" without pretending they're all in the same chat window.

---

## Agent Run

An **Agent Run** is a lightweight record created every time an agent starts working on a task.

It links:
- the **agent**
- the **task** that triggered it
- the **run** metadata (timestamps, status, logs, artifacts)

Runs matter because the same agent may act on the same task multiple times across its lifecycle. Runs also allow traceability: "what happened, when, by whom, using what tools".

**Core properties**
- `id`
- `agentId`
- `taskId`
- `threadId` (optional but common)
- `startedAt`, `finishedAt`
- `result` / summary
- `workspaceRef` (optional)
- `logsRef` (optional)

---

## Orchestrator (runtime)

Agents run in a separate process: the **orchestrator** (name TBD — this is runtime, not a primitive).

The orchestrator:
- listens to backend events (via WebSocket)
- decides when to trigger agent runs based on status changes / rules
- spins up an isolated workspace per run
- manages execution of the agent harness

**Workspace rule:** each agent-task run gets a **new clean directory**.
If the task is related to a git repo, the orchestrator clones the repo first, then executes inside that workspace. This avoids cross-run contamination and makes runs reproducible.

This is the engine room. It's how Taico becomes "alive".

---

## Tags (Meta)

**Meta is tags.**

Tags are simple labels. No taxonomy religion. They exist to:
- filter
- group
- trigger lightweight organization

They're also how we avoid creating a million "entities" prematurely.

---

## Project

A **Project** is a grouper that is also a tag.

A project tag has the form:

`project:slug`

Projects exist because sometimes you need a little bit of metadata that travels with a group of tasks.

The key idea: **a project is a tag + metadata**.

Project metadata can include:
- associated git repo(s)
- default workspace settings
- default tools / MCP servers
- conventions (optional)

When the orchestrator initiates an agent run for a task with `project:slug`, it can use that metadata to populate the workspace (clone repo, configure env, etc.).

---

## Authorization & Actors

Everything is access-controlled.

We always know who the **actor** is (human user, agent identity, system identity). This is enforced via an authorization server that issues JWTs and gates access via scopes.

There are no anonymous actions. That's how you get safety, auditability, and collaboration without chaos.

---

## Doors (Interfaces)

Taico exposes three doors into the same system:

1) **REST API**
   Auth via JWT (header) or JWT cookie.

2) **WebSocket**
   Used for events and real-time collaboration. Also how the runtime listens and reacts.

3) **MCP (Model Context Protocol)**
   Supports MCP auth as per spec, including OAuth2.1 dynamic client registration and metadata discovery.

Same primitives underneath. Different entry points.

---

## Scopes

Every feature area (tasks, context, threads, tools, etc.) has **scopes**.

Scopes are the mechanism to gate access through all three doors. If you have scope X over REST, you should also be able to have scope X over MCP. The auth model is consistent regardless of interface.

---

## Tools (MCP Servers)

Tools are **capabilities** that agents can use.

Taico allows you to register **MCP Servers** (tools) that agents can call. It also acts as an authorization server / broker, including an OAuth token bridge for downstream systems when needed.

Agents don't get "raw access" to everything. They get tool access through registered servers and scopes. This is how you keep power without losing control.

---

## How the pieces fit together

A typical flow looks like this:

- A human creates a task and assigns it to an agent (or themselves).
- Status changes to a trigger state (e.g. "Ready", "In Progress", etc.).
- The orchestrator receives the event over WebSocket.
- The orchestrator creates an Agent Run, sets up a clean workspace (and clones repo if project metadata says so), then executes the agent harness.
- The agent writes progress and decisions back into the task as comments.
- If the agent needs parallel work, it creates subtasks; the system creates/links a thread automatically.
- Other agents pick up those tasks independently, sharing discoveries via the thread.
- Everything is authorized and attributable to an actor, across REST/WebSocket/MCP.

That's the whole system. Simple primitives, strong runtime.
