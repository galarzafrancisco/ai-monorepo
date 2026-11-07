# Workspaces

A workspace is one company or team's own space in Taico. Its people, agents, tasks, threads, context, AI models and settings are kept apart from every other workspace on the same installation.

> **Status:** phase 1 of 5 is built (the workspace, its members, and the `workspace_id` token claim). Nothing is scoped by workspace yet: every installation has exactly one workspace and everyone is in it. See [Phases](#phases).

## The model

| Table | What it is |
|---|---|
| `workspaces` | id, unique `slug`, `name`. Soft-deleted. |
| `workspace_members` | One row per actor per workspace, with a `role`: `admin` or `member`. Unique on (`workspace_id`, `actor_id`). |

- **Members are actors**, not users, so people and agents are handled the same way.
- **A person can belong to several workspaces.** Their login (`users`) and their actor are installation-wide; only membership is per workspace.
- **An agent belongs to exactly one workspace.** It is created in a workspace and never moves.
- **Workspace admin** is the `admin` role on a membership. It replaces what `user:admin` means today: managing members and the workspace's shared settings (AI models, integrations, MCP registry, secrets).

### The default workspace

Every installation has a workspace with the fixed id `00000000-0000-4000-8000-000000000001` (slug `default`, `DEFAULT_WORKSPACE_ID` in `apps/backend/src/workspaces/workspaces.constants.ts`). The id is fixed so later migrations can backfill `workspace_id` columns with a constant instead of a lookup.

The `Workspaces1763500000000` migration creates it and puts every existing actor in it. People with `users.role = 'admin'` become workspace admins. Databases run with schema sync (`TYPEORM_SCHEMA_MODE=sync`) skip migrations, so `WorkspacesService.onModuleInit` does the same on every startup: it creates the default workspace if missing and adds every actor with no membership, with the same role rule. Existing memberships are left alone.

While there is only one workspace, `WorkspaceMembershipSubscriber` puts every new actor in it and keeps a person's workspace role in step with `users.role`. It hooks actor and user inserts (and `save()` updates of `users.role`) rather than each caller, because actors are created in several places (people, managed users, agents, seeds). A role change written with `update()` instead of `save()` is not seen. In phase 4, the workspace and role come from whoever creates the actor, and the subscriber goes away.

## How a request knows its workspace

**Decision: the token carries the workspace. URLs do not.**

Every access token Taico mints (web sessions, MCP OAuth, issued agent and worker tokens) has a `workspace_id` claim: the workspace the actor is working in. Every request made with that token is scoped to that workspace. Tokens minted before workspaces existed have no claim; from phase 2 they are treated as the default workspace until they expire.

Why not `taico.app/<workspace>/...`:

- **Nothing else changes.** REST routes, the WebSocket, MCP endpoints, OAuth resource URLs (RFC 8707 audiences), webhook URLs and worker configuration all stay as they are. A workspace segment would touch every one of them, and MCP clients would need a different server URL per workspace.
- **One place to trust.** The workspace is signed into the token by the authorization server, which checked membership when it minted it. A workspace in the URL would be client input that every handler has to check against membership anyway.
- **Agents and workers live in one workspace**, so for them a URL segment would only be redundant.

What it costs:

- **Switching workspace means a new token.** A person in several workspaces picks one; the web app asks for a new session token for it (phase 4: `POST /auth/web/switch-workspace`, which checks membership). MCP and issued tokens are minted for one workspace and stay in it.
- **Links.** Tasks, threads and blocks have UUIDs, so a link like `/tasks/task/<id>` keeps working. If it belongs to another workspace the person is a member of, the UI offers to switch instead of showing "not found". The UI may still show the workspace slug in its own routes for readability; that is a UI concern, not an API one.

## How data is kept apart

**Decision: a `workspace_id` column on every table that holds workspace data**, `NOT NULL`, foreign key to `workspaces`, indexed, backfilled to the default workspace.

- **Services scope every query.** Controllers read the workspace from the token (`@CurrentWorkspace()`, phase 2) and pass it to services as a plain argument, like the actor today. Services put it in every `where`, and repositories never look a row up by id alone. Looking up a row from another workspace answers "not found", never "forbidden", so ids from other workspaces cannot be probed.
- **Uniqueness becomes per workspace.** Constraints such as tag names, project slugs or "one model selection per job" become unique on (`workspace_id`, ...).
- **References stay inside a workspace.** A task's assignee, a comment's author, a thread's tasks and so on must be members of, or rows in, the same workspace. Services check this when the reference is set.
- **Real-time events** go to rooms prefixed with the workspace, so a socket only hears its own workspace.
- **Background work** (executions queue, timers, watches, webhooks, search indexing) carries the workspace of the row it works on and runs as that workspace.
- **Possible later: Postgres row-level security** as a second line of defence (`SET app.workspace_id` per transaction plus a policy per table). Not planned for now; the service-level scoping above is the rule.

### Which tables

Workspace data (gets `workspace_id`):

- Tasks: `tasks`, `comments`, `artefacts`, `task_input_requests`, `agent_runs`
- Threads: `threads`, `thread_messages`, `thread_agent_messages`, `thread_turns`, `thread_pins`, `thread_read_states`, `thread_task_subscriptions`, `thread_timers`, `thread_timer_firings`, `thread_watches`, `thread_watch_deliveries`
- Context and meta: `context_blocks`, `tags`, `tag_usage`, `projects`
- Agents: `agents`, `agent_tool_permissions`, `agent_tool_permission_scopes`
- Blueprints: `task_blueprints`, `scheduled_tasks`
- Executions: `task_execution_queue`, `active_task_executions`, `task_execution_history`, `execution_stats`, `execution_traces`
- Workers: `workers`
- AI models: `ai_providers`, `ai_model_selections`, `ai_provider_connections`, `ai_provider_authorization_attempts`
- Integrations: `github_connections`, `github_webhook_sources`, `pull_requests`, `pull_request_references`, `issues`, `issue_references`
- MCP registry: `mcp_servers`, `mcp_scopes`, `mcp_scope_mappings`, `mcp_connections`
- `secrets`
- Search index rows (they live on the indexed tables)

Child tables (comments, artefacts, thread messages...) also get the column, even though it could be joined from the parent, so every query can filter on it directly.

Installation-wide (no `workspace_id`):

- `users`, `actors` (identity; membership says where they belong)
- `workspaces`, `workspace_members`
- `jwks_keys`, `refresh_tokens`, `issued_access_tokens`, `mcp_refresh_tokens`, `registered_clients` (the authorization server; tokens carry the workspace in their claims)
- `authorization_journeys`, `mcp_authorization_flows`, `connection_authorization_flows`
- `access_requests` (people asking to join the installation)

Open question: **actor slugs** are unique across the installation today, and mentions (`@claude-dev`) use them. Two workspaces could not both have a `@claude-dev` agent. Options: keep slugs global (simple, a bit annoying), or make agent slugs unique per workspace and resolve mentions within the token's workspace. To be decided in phase 3, when agents get a workspace.

## AI models and the threads agent

**Decision: AI providers and model selections belong to the workspace.** A workspace admin sets them up in Settings → AI models; every member's threads use them. Nobody configures their own.

**Open question: the ChatGPT plan provider.** Today each person connects their own ChatGPT account and only their own turns run on it (see [Sign in with ChatGPT](../how-to-guides/sign-in-with-chatgpt.md)). That is deliberate: OpenAI's Sign in with ChatGPT terms tie a plan to the person who owns it, and require their tokens to stay on a machine they control. One admin's ChatGPT plan paying for every member's turns is account sharing, which those terms do not allow. Options:

1. Make API-key providers workspace-wide now, and keep the ChatGPT plan per person (the person's own plan, used only for their own turns, as today). The rest of the "whose plan pays" rules stay.
2. Drop the ChatGPT plan provider when multi-workspace ships, since hosted multi-company Taico is the "not allowed" deployment in that guide anyway.
3. Replace it with a workspace-level OpenAI API key (an organisation's own key, which may be shared).

This needs Fran's decision before phase 3 touches `ai_provider_connections`.

## Admin roles

Today `user:admin` comes from `users.role` and is installation-wide. With workspaces there are two different things:

- **Workspace admin**: the `admin` membership role. Manages that workspace's members and settings. From phase 2, the web session's `user:admin` scope comes from the membership role in the token's workspace, not from `users.role`.
- **Installation operator**: whoever runs the installation. Creates workspaces and handles access requests. Proposed as a new scope (e.g. `installation:admin`) for people with `users.role = 'admin'`, introduced in phase 4.

## Phases

Each phase ships on its own and leaves a working single-workspace installation.

1. **Workspace and membership** (done). `workspaces`, `workspace_members`, the default workspace, every actor a member, `workspace_id` in every minted token.
2. **Request context.** `@CurrentWorkspace()` from the token (default workspace when the claim is missing), WebSocket context, `user:admin` from the membership role.
3. **Scope the data**, module by module: add `workspace_id`, backfill to the default workspace, make it `NOT NULL`, scope every query, make uniqueness per workspace, prefix realtime rooms. Suggested order: meta/context, tasks, threads, agents and agent runs, executions and workers, AI providers and secrets, integrations, MCP registry, search. Each module gets e2e tests that a second workspace cannot see or touch the first one's rows.
4. **Many workspaces.** Create a workspace, invite and remove members, switch workspace (`POST /auth/web/switch-workspace`), installation operator scope, agents created in the caller's workspace, remove the membership subscriber.
5. **UI.** Workspace switcher, workspace settings and members page, the "switch workspace?" prompt on links from another workspace.
