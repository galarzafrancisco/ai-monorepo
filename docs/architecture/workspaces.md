# Workspaces

A workspace is one company or team's own space in Taico. Its people, agents, tasks, threads, context, AI models and settings are kept apart from every other workspace on the same installation.

> **Status:** phases 1 and 2 of 5 are built (the workspace, its members, the `workspace_id` token claim, and the workspace on every request). Phase 3 is under way: tasks, context blocks, tags and projects are scoped by workspace (3a). The other modules are not yet, so their routes refuse every workspace but the default one (see [the two rules](#entry-points-the-two-rules)). Every installation still has exactly one workspace and everyone is in it. See [Phases](#phases).

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

The `Workspaces1763500000000` migration creates the tables and the default workspace row. The row is created in the migration because later migrations backfill `workspace_id` columns with its id, and migrations run before the app starts. Memberships are added at startup: on every startup `WorkspacesService.onModuleInit` creates the default workspace if it is missing (databases run with schema sync, `TYPEORM_SCHEMA_MODE=sync`, skip migrations) and puts every actor with no membership in it. People with `users.role = 'admin'` become workspace admins (`workspaceRoleForUserRole`), everyone else and every agent a member. Existing memberships are left alone.

While there is only one workspace, `WorkspaceMembershipSubscriber` puts every new actor in it and keeps a person's workspace role in step with `users.role`. It hooks actor and user inserts (and `save()` updates of `users.role`) rather than each caller, because actors are created in several places (people, managed users, agents, seeds). A role change written with `update()` instead of `save()` is not seen. In phase 4, the workspace and role come from whoever creates the actor, and the subscriber goes away.

## How a request knows its workspace

**Decision: the token carries the workspace. URLs do not.**

Every access token Taico mints (web sessions, MCP OAuth, issued agent and worker tokens) has a `workspace_id` claim: the workspace the actor is working in. Every request made with that token is scoped to that workspace. Tokens minted before workspaces existed have no claim; from phase 2 they are treated as the default workspace until they expire.

Why not `taico.app/<workspace>/...`:

- **Nothing else changes.** REST routes, the WebSocket, MCP endpoints, OAuth resource URLs (RFC 8707 audiences), webhook URLs and worker configuration all stay as they are. A workspace segment would touch every one of them, and MCP clients would need a different server URL per workspace.
- **One place to trust.** The workspace is signed into the token by the authorization server, which checked membership when it minted it. A workspace in the URL would be client input that every handler has to check against membership anyway.
- **Agents and workers live in one workspace**, so for them a URL segment would only be redundant.

### Reading the workspace in code

Every transport builds the same `AuthContext` with `createAuthContext` (`apps/backend/src/auth/guards/context/auth-context.factory.ts`), and its `workspaceId` is the token's `workspace_id` claim, or `DEFAULT_WORKSPACE_ID` when the claim is missing.

- **HTTP controllers:** `@CurrentWorkspace() workspaceId: string` (`auth/guards/decorators/current-workspace.decorator.ts`). It needs `AccessTokenGuard` on the route.
- **WebSocket gateways:** the same decorator works in `@SubscribeMessage` handlers guarded by `WsAccessTokenGuard`. Outside a handler (connection hooks, room joins), read `(client.data.auth as AuthContext).workspaceId`. The worker gateway builds its context the same way.
- **MCP:** MCP endpoints are HTTP routes behind `AccessTokenGuard`, so the `AuthContext` handed to each MCP server (`authContext.workspaceId`) carries it.

The workspace is not checked against membership on each request: the authorization server checked it when it minted the token. Removing a member (phase 4) must also revoke or let expire their tokens for that workspace.

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

### How to scope a module (the phase 3 pattern)

Phase 3a (tasks, context blocks, tags, projects, and task blueprints with their schedules) set the pattern the other phase 3 tasks follow. Migration `WorkspaceScopeTasksContextMeta1763600000000` and `test/workspace-isolation.e2e-spec.ts` are the worked example.

1. **Migration.** For each table: `ADD "workspace_id" uuid NOT NULL DEFAULT '<default workspace id>'`, which backfills every existing row in one step. Then `DROP DEFAULT`, so a new row must say where it belongs. Then add an FK to `workspaces` (`ON DELETE RESTRICT`) and an index. Rebuild unique constraints as (`workspace_id`, ...). Register the migration in `app.module.ts`.
2. **Entity.** Add `@Index() @Column({ type: 'uuid', name: 'workspace_id' }) workspaceId!: string`, and move uniqueness to `@Index([...], { unique: true })` on (`workspaceId`, ...).
3. **Service.** Every public method takes `workspaceId: string` as its **first argument**. TypeScript then flags every caller, including other modules. Put `workspaceId` in every `where`, every `create()` and every query builder. Look rows up by (`workspaceId`, `id`), never by `id` alone. A row in another workspace throws the module's usual "not found" error. A service that resolves something it links to (tags, dependencies, a parent block, an assignee) resolves it in the same workspace. Assignees must be members (`WorkspacesService.isMember`).
4. **Controllers** add `@CurrentWorkspace() workspaceId: string` and pass it on, and switch their `@WorkspaceAccess('default-only')` to `'scoped'` (see [the two rules](#entry-points-the-two-rules)). **MCP gateways** read `const { workspaceId } = authContext` once in `buildServer` and pass it to every tool.
5. **Realtime.** Rooms are named with `workspaceRoom(workspaceId, room)` (`workspaces/workspace-rooms.ts`). On subscribe, a gateway joins the room of the socket's own workspace (`socketWorkspaceId(client)`). When it emits, it uses the workspace of the row in the event: entities carry `workspaceId`, and delete events carry it explicitly. Subscribe messages and wire events don't change, so clients need no update.
6. **Callers in modules not yet scoped** pass the workspace of the row they work on when they have one (e.g. the stale-execution pruner uses the task's workspace). Otherwise they pass `UNSCOPED_MODULE_WORKSPACE_ID` (`workspaces.constants.ts`). Each later phase greps for its module's uses and replaces them. Startup seeding of the default workspace uses `DEFAULT_WORKSPACE_ID`.
   **Entry points that bridge into a scoped module are scoped too, in the same phase.** If an endpoint or tool of a module not yet scoped reads, links or creates rows of a module that is, it takes the caller's workspace. Otherwise the bridge leaks. Start each phase by listing every entry point (see [Entry points](#entry-points-the-two-rules)), not by following the service signatures: a route can leak through a serializer (a thread response carries task summaries) or a side effect (a first message renames the state block) without calling a scoped method. In 3a, every public thread route checks the thread's workspace first, and so do the thread WebSocket, global search and the user-facing execution and agent-run routes. Blueprints create tasks, tags and projects, so in 3a they were scoped in full rather than bridged (`WorkspaceScopeBlueprints1763600000001` adds `workspace_id` to `task_blueprints` and `scheduled_tasks`). A schedule's blueprint must be in its workspace, and the scheduler runs each due schedule in that schedule's workspace. When a module that is not yet scoped creates rows of a scoped one, scoping it in full is often simpler and safer than guarding each bridge. Until threads get their own column (3b), **a thread's workspace is the workspace of its state block**, which is always created in the caller's workspace (`ThreadsService.threadWhere`). Internal listeners that start from a row keep the unscoped `getThreadById` / `findThreadByTaskId` until 3b.
   **Validate before the first write.** Resolve everything a new row links to (dependencies, tasks, blocks) before saving anything, so a request that fails because a linked row is in another workspace leaves nothing behind.
7. **Search** is scoped in 3e. Until then, a scoped module's search, and global search (`GlobalSearchService`), drop hits whose row is in another workspace.
8. **e2e tests** sign a token for a second workspace and check that its rows answer 404 over REST, `isError` over MCP, and are never heard over the WebSocket. Once a route is `scoped`, `workspace-entry-points.e2e-spec.ts` sweeps it automatically. Seed the module's rows there, with the canary in their text, so the sweep has A rows to probe.

**Join tables** (task_tags, task_dependencies, context_block_tags, project_auto_tags, task_auto_tags) get no `workspace_id`. They are only reached through a parent that is already scoped, and services resolve both ends in the same workspace. TypeORM's ManyToMany writes only the two ids, so a column there would need triggers or a custom join entity. Child tables with their own rows (comments, artefacts, input requests, tag usage) do get the column.

**Tags and projects:** tag names are unique per workspace (`uq_tags_workspace_name_ci` on `workspace_id, lower(name)`) and so are project slugs (`UQ_projects_workspace_slug`). System tags are created in every workspace at startup (`MetaService.ensureSystemTags`; phase 4 calls it when it creates a workspace).

### Entry points: the two rules

Two rules hold for the whole app, whichever module owns an entry point and whether or not its tables have a `workspace_id` yet:

1. **Every externally reachable entry point enforces workspace isolation.** This covers REST routes, MCP endpoints and tools, and WebSocket messages and connections.
2. **Every worker operation on an execution checks both the workspace and the worker's authority.** The execution's task must be in the token's workspace, and the worker must be the one that claimed the execution.

Both rules use one shared mechanism each, not checks added endpoint by endpoint.

**`@WorkspaceAccess(mode)`** (`auth/guards/decorators/workspace-access.decorator.ts`) goes on every controller and gateway, on the class or per handler. `AccessTokenGuard` and `WsAccessTokenGuard` enforce it right after they validate the token (`enforceWorkspaceAccess` in `auth/guards/guards/workspace-access.ts`). They **fail closed**: an authenticated route or message with no mode is refused (`WORKSPACE_ACCESS_UNDECLARED`). The modes are:

| Mode | Meaning | Where |
|---|---|---|
| `scoped` | The handler passes `@CurrentWorkspace()` and the service scopes every query. A row in another workspace answers "not found". | Tasks, context, meta tags and projects, blueprints and schedules, threads (through their state block until 3b), global search, actors (members of the workspace), walkthrough, agent runs, the user-facing execution routes (queue list and claim, active list, interrupt, history, traces), the tasks and context MCP endpoints, and the `/tasks`, `/context` and `/threads` sockets. |
| `default-only` | The module has no `workspace_id` yet, so all its rows belong to the default workspace. A token for any other workspace answers 404 (`NOT_IN_WORKSPACE`) before the handler runs. | Agents (definitions, tokens, execution tokens, tool permissions), AI providers, model selections and connections, secrets, the MCP registry and auth journeys, GitHub connections, pull requests and issues (REST and sockets), workers (REST and socket), the `/executions` socket, search admin, OAuth client listing, access-request admin, and `/auth/users` management. The `/executions/worker` socket is also refused at connection for another workspace, because connecting records the worker. |
| `worker` | A worker's call on one execution. The handler passes the caller to `findWorkerExecution`. | `/executions/active/:id/{stop,unclaim,session,tool-calls/increment,stats,github-credentials}` and the worker socket's trace, activity and execution heartbeat messages. |
| `installation` | Not workspace data. | Sign-in, refresh, logout, `me`, password, onboarding, OAuth (authorize, token, consent, register, introspect, callback), JWKS, discovery, health, the tag palette and version, GitHub webhooks (checked by signature) and the public access-request form. Routes with no token are always this. |

When a phase migrates a module, its routes move from `default-only` to `scoped`.

**`findWorkerExecution(manager, { workspaceId, workerClientId }, executionId)`** (`executions/worker-execution-access.ts`) runs before anything is read or written. An execution whose task is in another workspace is not found. An execution claimed by another worker answers `ActiveTaskExecutionWorkerMismatchError` (403). With `includeFinished`, an execution that already moved to history still counts, for late stats and traces. Claims are scoped too: a worker lists and claims only the tasks of its token's workspace.

**How the rules are proven.** `test/workspace-entry-points.e2e-spec.ts` discovers every route and message handler from the running app, so new entry points are covered as soon as they exist:

1. Every route and message has a mode, and everything but `installation` sits behind the access token guard.
2. Every `default-only` route answers `NOT_IN_WORKSPACE` to a workspace-B token, and still works for the default workspace. Every `default-only` socket message is refused.
3. Workspace A's rows are seeded with a canary string in every text. Then every `scoped` and `worker` route is called with a workspace-B token, every MCP tool is called, and every socket message is sent from B. Path parameters and body ids are filled with A's ids, and bodies are built from the OpenAPI schema so they pass validation. The test asserts:
   - No response contains the canary, and no success contains an A id.
   - No route answers with a 5xx.
   - A's rows are unchanged: every table is hashed over rows in A or pointing at an A id.
   - No B socket hears anything about A while A edits its rows, even with the same person signed in to both.
4. Worker routes and messages called by another worker of the same workspace change nothing.

`test/workspace-isolation.e2e-spec.ts` keeps the behaviour tests (what B sees, what B can link, uniqueness per workspace).

### Paths that cross modules: the third rule

Guarding the door of a module does not protect calls into it from another module. A `scoped` thread route can still reach GitHub data, AI providers or the MCP endpoints through the threads service. So a third rule holds:

3. **A workspace travels with every call into another module, and the receiving module enforces it.** No module works out a workspace by itself from an actor or a URL.

Three shared pieces apply this:

- **Tokens Taico mints for itself name their workspace.** `IssuedAccessTokenService` takes a required `workspaceId`. It refuses (`TOKEN_ACTOR_NOT_IN_WORKSPACE`, 403) unless both the subject and the issuer are members. The token's `workspace_id` claim is always that workspace, never the subject's oldest membership. The threads agent and the middle manager pass the thread's workspace (`TaicoMcpToolsFactory.open({ workspaceId })`). Agent tokens and execution tokens pass the caller's.
- **Modules without `workspace_id` hold only default-workspace data.** `workspaces/unscoped-modules.ts` has one predicate, `holdsUnscopedModuleData(workspaceId)`, and its assertion, which answers `NOT_IN_WORKSPACE`. `default-only` uses it at the door. Services that other modules call use it inside:
  - Pull requests and issues: `lookup`, `listLinkedToTasks` and `replaceReferences` take the workspace. A link written in a task or thread outside the default workspace is not recorded. So it is never read from GitHub with the default workspace's connections, and it never shows up next to the thread. The thread agent's pull request tools pass the thread's workspace.
  - AI models: `ChatModelFactory.resolve({ workspaceId })`. Threads agent turns, titles and the middle manager outside the default workspace find no model until phase 3d.
  - Global search: every result type has an explicit rule in a total `Record<SearchResultType, …>`. Agents and tools are default-workspace rows, so a new type does not compile until it says who sees it. A hit is kept only when its rule finds it visible.
- **The tests probe composed paths, not just entry points:** an own B parent plus a foreign link or resource, outgoing tokens, and search queries that match seeded protected content. Each is checked in both directions:
  - `thread-agent-mcp.e2e-spec.ts`: the agent's token for B fetches and updates B's task but not A's, and A's token cannot reach B's. No token is issued in a workspace the agent is not a member of. No turn in another workspace mints a token outside it.
  - `workspace-isolation.e2e-spec.ts`: a B task links A's cached pull request and issue, and B's thread shows neither, with no reference recorded, while the same links in A do show. The thread agent's pull request tools refuse from B. A search matching A's agent's canary finds it in A and returns nothing about it to B.

When a phase migrates one of these modules, replace its `holdsUnscopedModuleData` checks with a `workspace_id` filter. The `workspaceId` parameters are already in place.

**Not entry points.** Internal listeners and background work start from a row, not a request, and use that row's workspace. These are:
- the thread reconciler and assignment projector
- the execution context resolver and task activity projection
- the readiness and queue populator and the stale-execution pruner
- the blueprint scheduler, search indexing and startup seeding

They may keep unscoped lookups (`getThreadById`, `findThreadByTaskId`) until 3b/3c. A public transport must never call them. Static files, `/launch` and the API docs carry no workspace data.
Open question: **actor slugs** are unique across the installation today, and mentions (`@claude-dev`) use them. Two workspaces could not both have a `@claude-dev` agent. Options: keep slugs global (simple, a bit annoying), or make agent slugs unique per workspace and resolve mentions within the token's workspace. To be decided in phase 3, when agents get a workspace.

## AI models and the threads agent

**Decision: AI providers and model selections belong to the workspace.** A workspace admin sets them up in Settings → AI models; every member's threads use them. Nobody configures their own.

**Decision: the ChatGPT plan provider stays per person.** Each person connects their own ChatGPT account and only their own turns run on it, as today (see [Sign in with ChatGPT](../how-to-guides/sign-in-with-chatgpt.md)). OpenAI's Sign in with ChatGPT terms tie a plan to the person who owns it and require their tokens to stay on a machine they control, so one admin's plan cannot pay for every member's turns. The ChatGPT plan is a personal-use option. Companies do not get it: a workspace admin provides an LLM through an API-key provider (an organisation's own key may be shared by its members). Phase 3 moves API-key providers and model selections to the workspace and leaves the ChatGPT plan's "whose plan pays" rules as they are.

## Admin roles

Today `user:admin` comes from `users.role` and is installation-wide. With workspaces there are two different things:

- **Workspace admin**: the `admin` membership role. Manages that workspace's members and settings. The web session's `user:admin` scope comes from the membership role in the token's workspace, not from `users.role` (`WebAuthService.generateWebAccessToken`). While there is one workspace, `WorkspaceMembershipSubscriber` keeps the two in step, so nothing changes for anyone whose role is changed through the app. A role changed directly in the database (or with `update()` instead of `save()`) only reaches the session if the membership row is changed too. An actor with no membership (only before the startup backfill has run) still gets the scope from `users.role`.
- Managing people (`/auth/users`) still checks `users.role`: logins are installation-wide, so this moves to the installation operator scope in phase 4.
- **Installation operator**: whoever runs the installation. Creates workspaces and handles access requests. Proposed as a new scope (e.g. `installation:admin`) for people with `users.role = 'admin'`, introduced in phase 4.

## Phases

Each phase ships on its own and leaves a working single-workspace installation. Phases 2–5 are tracked as Taico tasks named "Workspaces phase N: …"; phase 3 is split into 3a–3e by module.

1. **Workspace and membership** (done). `workspaces`, `workspace_members`, the default workspace, every actor a member, `workspace_id` in every minted token.
2. **Request context** (done). `@CurrentWorkspace()` from the token (default workspace when the claim is missing), WebSocket and MCP context, `user:admin` from the membership role.
3. **Scope the data**, module by module (3a, tasks, context and meta: done; see [How to scope a module](#how-to-scope-a-module-the-phase-3-pattern)): add `workspace_id`, backfill to the default workspace, make it `NOT NULL`, scope every query, make uniqueness per workspace, prefix realtime rooms. Suggested order: meta/context, tasks, threads, agents and agent runs, executions and workers, AI providers and secrets, integrations, MCP registry, search. Each module gets e2e tests that a second workspace cannot see or touch the first one's rows.
4. **Many workspaces.** Create a workspace, invite and remove members, switch workspace (`POST /auth/web/switch-workspace`), installation operator scope, agents created in the caller's workspace, remove the membership subscriber.
5. **UI.** Workspace switcher, workspace settings and members page, the "switch workspace?" prompt on links from another workspace.
