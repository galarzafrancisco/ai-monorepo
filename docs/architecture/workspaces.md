# Workspaces

A workspace is one company or team's own space in Taico. Its people, agents, tasks, threads, context, AI models and settings are kept apart from every other workspace on the same installation.

> **Status:** all 5 phases are built. Every module's data is scoped by workspace (phase 3). An installation operator can create workspaces. Workspace admins invite, re-role and remove members. A person switches workspace with `POST /auth/web/switch-workspace` (phase 4, see [Many workspaces](#many-workspaces-phase-4)). Only auth journeys and OAuth client listing are still `default-only`. Phase 5 added the UI (see [The UI](#the-ui-phase-5)). See [Phases](#phases).

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

The `Workspaces1763500000000` migration creates the tables and the default workspace row. The row is created in the migration because later migrations backfill `workspace_id` columns with its id, and migrations run before the app starts. On every startup `WorkspacesService.onModuleInit` also creates the default workspace if it is missing, because databases run with schema sync (`TYPEORM_SCHEMA_MODE=sync`) skip migrations.

**Every actor gets its membership when it is created**, in the same transaction (`addWorkspaceMembership` in `workspaces/workspaces.service.ts`):
- An agent joins the workspace it is created in (`AgentsService.createAgent`).
- The first person (onboarding) becomes the default workspace's admin.
- `IdentityProviderService.createUser` and `createManagedUser` take the workspace and role. Without one they use the default workspace.
- An invited person joins the inviting workspace (see [Members](#members)).

Phases 1 to 3 did this with `WorkspaceMembershipSubscriber`, and phase 4 removed it. `users.role` no longer decides any workspace role (see [Admin roles](#admin-roles)).

The startup backfill (`WorkspacesService.onModuleInit`) puts every actor with no membership in the default workspace: people with `users.role = 'admin'` as admins, everyone else and every agent as members. This covers a database whose app last ran before workspaces. **It runs once per installation.** When it finishes it sets `workspaces.members_backfilled_at` on the default workspace, in the same transaction, and it never runs again (migration `WorkspaceMembersBackfilled1764100000001`; schema-sync databases get the column from the entity). It locks the default workspace row while it runs, so backends that start together run it only once.

After that, an actor with no membership was removed from every workspace on purpose. It stays out across restarts, however old the account is. The actor's age can't tell a never-backfilled account from a removed one, so the backfill doesn't check it.

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

The workspace is not checked against membership on each request: the authorization server checked it when it minted the token. A removed member keeps access until the token expires (see [Removing a member](#members)).

What it costs:

- **Switching workspace means a new token.** A person in several workspaces picks one, and the web app asks for a new session token for it (`POST /auth/web/switch-workspace`, which checks membership; see [Switching](#switching)). MCP and issued tokens are minted for one workspace and stay in it.
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
   **Entry points that bridge into a scoped module are scoped too, in the same phase.** If an endpoint or tool of a module not yet scoped reads, links or creates rows of a module that is, it takes the caller's workspace. Otherwise the bridge leaks. Start each phase by listing every entry point (see [Entry points](#entry-points-the-two-rules)), not by following the service signatures: a route can leak through a serializer (a thread response carries task summaries) or a side effect (a first message renames the state block) without calling a scoped method. In 3a, every public thread route checked the thread's workspace first, and so did the thread WebSocket, global search and the user-facing execution and agent-run routes. Blueprints create tasks, tags and projects, so in 3a they were scoped in full rather than bridged (`WorkspaceScopeBlueprints1763600000001` adds `workspace_id` to `task_blueprints` and `scheduled_tasks`). A schedule's blueprint must be in its workspace, and the scheduler runs each due schedule in that schedule's workspace. When a module that is not yet scoped creates rows of a scoped one, scoping it in full is often simpler and safer than guarding each bridge. Between 3a and 3b a thread's workspace was its state block's; 3b gave threads their own column (see [Threads](#threads-phase-3b)).
   **Validate before the first write.** Resolve everything a new row links to (dependencies, tasks, blocks) before saving anything, so a request that fails because a linked row is in another workspace leaves nothing behind.
7. **Search.** Since 3e every index row carries its item's workspace, and every search filters on it in SQL (see [phase 3e](#github-mcp-registry-and-search-phase-3e)). The visibility check in global, task and context search stays as a second line.
8. **e2e tests** sign a token for a second workspace and check that its rows answer 404 over REST, `isError` over MCP, and are never heard over the WebSocket. Once a route is `scoped`, `workspace-entry-points.e2e-spec.ts` sweeps it automatically. Seed the module's rows there, with the canary in their text, so the sweep has A rows to probe.

**Join tables** (task_tags, task_dependencies, context_block_tags, project_auto_tags, task_auto_tags) get no `workspace_id`. They are only reached through a parent that is already scoped, and services resolve both ends in the same workspace. TypeORM's ManyToMany writes only the two ids, so a column there would need triggers or a custom join entity. Child tables with their own rows (comments, artefacts, input requests, tag usage) do get the column.

### Threads (phase 3b)

Migration `WorkspaceScopeThreads1763700000000` adds `workspace_id` to `threads` and every table that hangs off a thread: messages, the agent log, turns, pins, read states, task subscriptions, timers, timer firings, watches and watch deliveries. Threads are backfilled from their state block (the 3a rule), and every child row from its thread.

- **A child row is always in its thread's workspace.** Raw inserts read it from the thread in the same statement (`INSERT … SELECT … FROM threads WHERE id = $thread AND workspace_id = $workspace`), so a thread in another workspace gets nothing written, and the writer learns that from the empty result. The agent log takes it from the thread row it locks, and a watch delivery from its watch.
- **Every lookup takes the workspace first**, including the ones internal listeners use (`getThreadById`, `findThreadByTaskId`, `findThreadsByParentTaskId`). Listeners pass the workspace of the row they start from: a task event's workspace (state reconciler, task-subscription notifier, assignment projector) or the claimed turn's (`ThreadTurnsService.tryClaim` returns the thread's workspace, and everything in the agent turn uses it).
- **No unique constraint changed.** Every thread constraint is keyed by a thread id (one thread per parent task, one running turn, one watch per target), and a thread is in one workspace.
- **Join tables** (`thread_tasks`, `thread_context_blocks`, `thread_tags`, `thread_participants`) get no column. The service resolves both ends in the thread's workspace.
- **Every thread room is in a workspace**, the per-thread rooms included. Every thread event carries the thread's `workspaceId` (entities carry it, payloads and the delete event name it), so the gateway emits without a lookup.
- **Timers across backends.** One `fireDue` sweep fires due timers of every workspace (`FOR UPDATE SKIP LOCKED`, so each firing is claimed once). Each firing is in its timer's workspace, and the turn that delivers it runs in the thread's workspace.
- **A task changing only wakes threads in its own workspace** (`markTriggered` and `removeForDeletedTask` filter on the task's workspace).
- Pull request watches are found by target within a workspace (`listForTarget` and `latestExpiry` take the workspace since 3e).

**Tags and projects:** tag names are unique per workspace (`uq_tags_workspace_name_ci` on `workspace_id, lower(name)`) and so are project slugs (`UQ_projects_workspace_slug`). System tags are created in every workspace at startup (`MetaService.ensureSystemTags`, which is also called when a workspace is created).

### Agents, executions and workers (phase 3c)

Migration `WorkspaceScopeAgentsExecutions1763800000000` adds `workspace_id` to `agents`, `agent_tool_permissions`, `agent_tool_permission_scopes`, `agent_runs`, `task_execution_queue`, `active_task_executions`, `task_execution_history`, `execution_stats`, `execution_traces` and `workers`. An agent is backfilled from its actor's membership, and its tool permissions from the agent. Runs, queue entries, active executions and history come from their task, and stats and traces from their execution. Workers stay in the default workspace, because until 3c only default-workspace tokens could connect one.

- **An agent is created in the caller's workspace and is a member of that workspace only.** `AgentsService.createAgent` sets the membership in the same transaction. It also removes the default-workspace membership `WorkspaceMembershipSubscriber` adds to every new actor.
- **Executions are in their task's workspace.** `findWorkerExecution` filters on the execution's own `workspace_id`. Claims, unclaims, stops and the stale-execution pruner write each row in the execution's workspace.
- **The queue populator** runs across every workspace. It starts from tasks and matches a task only to an active agent of the task's workspace.
- **A worker is an OAuth client in a workspace**, the workspace of the token it connected with: unique on (`workspace_id`, `oauth_client_id`). The same client connecting with another workspace's token is another worker. Worker tokens already carry `workspace_id` (minted from the membership of the person who authorized the worker). Registered OAuth clients stay installation-wide.
- **Realtime.** The `executions`, `execution-traces-<id>` and `workers` rooms are workspace-prefixed. Every worker socket joins its workspace's `workers` room, and `task.execution.queued` goes only to that room. Before 3c it was broadcast to every worker. Interrupts go to the claiming worker's sockets in the execution's workspace.
- **Tool permissions** have the column. Until 3e, granting and revoking were `default-only`; since 3e a grant can be written in any workspace, and it can only point at that workspace's servers. Agents of other workspaces get only Taico's baseline tools (tasks and context). A worker sets up any workspace's agent the same way, so two reads are `scoped`: listing an agent's tool permissions (outside the default workspace, just the baseline servers) and `GET /mcp/servers/:serverId` (outside the default workspace, only the baseline servers; any other server answers 404). The worker gets the baseline servers' config and an execution token, and the agent's tool calls run in its own workspace. Outside the default workspace, a baseline server's transport is Taico's built-in one: HTTP, Taico auth, and the issuer URL plus the fixed tasks or context path (`mcp-registry/baseline-servers.ts`). It is never the registry row's URL or command. The default workspace can still edit those rows, and the worker attaches the agent's execution token to whatever URL it is given. Serving the row would let one workspace collect another workspace's tokens. 3e keeps this (see [phase 3e](#github-mcp-registry-and-search-phase-3e)).
- **The threads agent** is the `taico` agent of the thread's workspace. Every new workspace is seeded with one, along with the other built-in agents (see [Creating a workspace](#creating-a-workspace)); a workspace without one has its turns fail with "agent not found". Since 3d they use their own workspace's models, once its admin has set some up.

#### Actor slugs

**Decision: an agent's slug is unique within its workspace. A person's slug is unique across the installation.** Each workspace can have its own `@claude-dev`. A person can join any workspace, so a person's slug must never collide with anyone's.

- The global unique constraint on `actors.slug` is now a partial unique index for people (`UQ_actors_person_slug`, `WHERE type <> 'agent'`).
- Every slug write (person or agent, create or rename) goes through `claimActorSlug` (`identity-provider/actor-slug.ts`) in the transaction that saves the actor. It holds a transaction-scoped advisory lock on the slug. A person's slug conflicts with any actor's. An agent's slug conflicts with a person's, or with an actor in its own workspace.
- Every change to an existing actor (agent patch or delete, account setup, deactivation) re-reads the agent or user row and then the actor row with `FOR UPDATE` inside its transaction (`lockLiveActor`). It writes only the columns it changes. A write that waited on a concurrent rename or delete works from the committed rows: it can't bring back a slug the actor gave up, or undo a delete.
- **Slugs resolve in a workspace.** `ActorService.getActorBySlug`, `getActorByIdOrSlug` and `getActiveActorByIdOrSlug` take the workspace and only find its members. Assignees, creators and agent routes (`/agents/:slug`, tokens, execution tokens) resolve `@slug` in the token's workspace. Ids stay global.

### GitHub, MCP registry and search (phase 3e)

Migration `WorkspaceScopeIntegrationsMcpSearch1764000000000` adds `workspace_id` to `github_connections`, `github_webhook_sources`, `pull_requests`, `pull_request_references`, `issues`, `issue_references`, `mcp_servers`, `mcp_scopes`, `mcp_connections`, `mcp_scope_mappings` and `search_documents`. Existing rows backfill to the default workspace.

**GitHub**
- **Each workspace caches its own copy of a pull request or issue** (unique on (`workspace_id`, `key`)), and reads it only with its own connections. A link to a private pull request in B never reads A's credentials or A's cache. Enterprise hosts are per workspace too.
- A connection's secret is in the connection's workspace. A project can only name a connection of its own workspace, and worker GitHub credentials resolve projects and connections in the execution's workspace.
- **Webhooks.** The webhook URL names only the connection, so `acceptWebhookDelivery` is the one lookup by id alone. Once the signature checks out, changes are confined to that connection's workspace.
- The `/pull-requests` and `/issues` rooms are workspace-prefixed.

**MCP registry**
- **A server's `providedId` stays unique across the installation**, because it names the OAuth resource in `/mcp/<providedId>/...` URLs, which carry no workspace. So a workspace creating a `providedId` another workspace already uses gets a 409, which tells it the name is taken. A connection's `providedId` is unique per workspace.
- **Taico's baseline servers** (tasks, context) stay default-workspace rows. Every workspace lists and reads them, but outside the default workspace it gets Taico's built-in transport, never the row's URL or command (the 3c guarantee). Every write needs the workspace's own server.
- **MCP OAuth tokens.** For Taico's own servers the token's workspace is the person's oldest membership (there is no picker yet; a person in no workspace gets no token). For any other server it is the server's workspace, and the person must be a member there (`TOKEN_ACTOR_NOT_IN_WORKSPACE` otherwise), checked on every code exchange and refresh. The authorization server, discovery and auth journeys still find servers across the installation, by OAuth resource.
- **Downstream token exchange** (`/auth/token-exchange/mcp/...`) works in the token's workspace. The connection, its scope mappings and the authorized flow must all be that workspace's, so a B token for the shared `tasks` server never reaches A's connection, even by its UUID. The flow must also be the token's own journey: the same person (`sub`) and the same client. Another person's or another client's flow on the same connection does not count.
- **The auth-journeys monitor** (`GET /auth-journeys/servers/:id`, still `default-only`) shows a server only if the caller's workspace can see it: its own server or a baseline server. Another workspace's server answers 404. It lists only journeys of the workspace's members, and only the connection flows of the workspace's own connections, because a baseline server's journeys include other workspaces' people.

**Search**
- `search_documents.workspace_id` is added by `SEARCH_WORKSPACE_SCHEMA_STATEMENTS`. It has no FK, because the original lexical search migration runs before `workspaces` exists, and the rows are derived data.
- Every projection outputs its item's workspace. Keyword, fuzzy and semantic search all filter on `workspace_id` before the limit. The embedder works per workspace, with that workspace's embeddings model, and a query is embedded with the caller's.
- Search settings stay installation-wide. Since phase 4, only the installation operator writes them and rebuilds the index (`installation` mode, `installation:admin` as well as `search:configure`), from any workspace. Reading the settings and the index status is `scoped`, and the status is per workspace.

**Not changed (still open after phase 4):** GitHub and MCP registry writes need only the module scopes, which every web session has, not workspace admin.

### Entry points: the two rules

Two rules hold for the whole app, whichever module owns an entry point and whether or not its tables have a `workspace_id` yet:

1. **Every externally reachable entry point enforces workspace isolation.** This covers REST routes, MCP endpoints and tools, and WebSocket messages and connections.
2. **Every worker operation on an execution checks both the workspace and the worker's authority.** The execution's task must be in the token's workspace, and the worker must be the one that claimed the execution.

Both rules use one shared mechanism each, not checks added endpoint by endpoint.

**`@WorkspaceAccess(mode)`** (`auth/guards/decorators/workspace-access.decorator.ts`) goes on every controller and gateway, on the class or per handler. `AccessTokenGuard` and `WsAccessTokenGuard` enforce it right after they validate the token (`enforceWorkspaceAccess` in `auth/guards/guards/workspace-access.ts`). They **fail closed**: an authenticated route or message with no mode is refused (`WORKSPACE_ACCESS_UNDECLARED`). The modes are:

| Mode | Meaning | Where |
|---|---|---|
| `scoped` | The handler passes `@CurrentWorkspace()` and the service scopes every query. A row in another workspace answers "not found". | The current workspace and its members (`/workspaces/current/...`), tasks, context, meta tags and projects, blueprints and schedules, threads, AI providers, model selections and ChatGPT plan connections, secrets, global search and search status, GitHub connections, pull requests and issues (REST and sockets), the MCP registry, agent tool permissions, actors (members of the workspace), walkthrough, agents (definitions, import/export, tokens, execution tokens), agent runs, the user-facing execution routes (queue list and claim, active list, interrupt, history, traces), workers, the tasks and context MCP endpoints, and the `/tasks`, `/context`, `/threads`, `/executions`, `/workers` and `/executions/worker` sockets. |
| `default-only` | The module has no `workspace_id` yet, so all its rows belong to the default workspace. A token for any other workspace answers 404 (`NOT_IN_WORKSPACE`) before the handler runs. | Auth journeys and OAuth client listing. |
| `worker` | A worker's call on one execution. The handler passes the caller to `findWorkerExecution`. | `/executions/active/:id/{stop,unclaim,session,tool-calls/increment,stats,github-credentials}` and the worker socket's trace, activity and execution heartbeat messages. |
| `installation` | Not workspace data. | Sign-in, refresh, logout, `me`, switching workspace, listing your workspaces, and the installation operator's routes (creating a workspace, `/auth/users`, access-request admin, search settings writes and index rebuild). Also password, onboarding, OAuth (authorize, token, consent, register, introspect, callback), JWKS, discovery, health, the tag palette and version, GitHub webhooks (checked by signature) and the public access-request form. Routes with no token are always this. |

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
  - Pull requests and issues (scoped in 3e): `lookup`, `listLinkedToTasks` and `replaceReferences` take the workspace. A link is recorded against the workspace's own copy of the pull request or issue, which is read only with that workspace's connections. The thread agent's pull request tools pass the thread's workspace.
  - AI models (scoped in 3d): `ChatModelFactory.resolve({ workspaceId })` resolves the job's selection, and a thread's own provider, in that workspace only. Since 3e, search embeddings use each workspace's own model, and GitHub connections keep their secrets in their own workspace.
  - Global search: every result type has an explicit rule in a total `Record<SearchResultType, …>`. Agents and tools are kept when they are in the caller's workspace, so a new type does not compile until it says who sees it. Since 3e the query itself filters on the workspace; the rule is a second line.
- **The tests probe composed paths, not just entry points:** an own B parent plus a foreign link or resource, outgoing tokens, and search queries that match seeded protected content. Each is checked in both directions:
  - `thread-agent-mcp.e2e-spec.ts`: the agent's token for B fetches and updates B's task but not A's, and A's token cannot reach B's. No token is issued in a workspace the agent is not a member of. No turn in another workspace mints a token outside it.
  - `workspace-isolation.e2e-spec.ts`: a B task links A's cached pull request and issue, and B's thread shows neither: the links point at B's own copies, while the same links in A show A's. The thread agent's pull request tools in B never return A's title, and whatever B watches is B's copy. A search matching A's agent's canary finds it in A and returns nothing about it to B, and A's matches never crowd B's out of a limited search.

When a phase migrates one of these modules, replace its `holdsUnscopedModuleData` checks with a `workspace_id` filter. The `workspaceId` parameters are already in place.

**Not entry points.** Internal listeners and background work start from a row, not a request, and use that row's workspace. These are:
- the thread reconciler and assignment projector
- the execution context resolver and task activity projection
- the readiness and queue populator and the stale-execution pruner
- the blueprint scheduler, search indexing and startup seeding

Thread lookups have no unscoped variant since 3b, and execution and agent-run lookups have none since 3c. Static files, `/launch` and the API docs carry no workspace data. Actor slugs are settled in [Actor slugs](#actor-slugs).

## AI models and the threads agent

**Decision: AI providers and model selections belong to the workspace.** A workspace admin sets them up in Settings → AI models; every member's threads use them. Nobody configures their own.

**Decision: the ChatGPT plan provider stays per person.** Each person connects their own ChatGPT account and only their own turns run on it, as today (see [Sign in with ChatGPT](../how-to-guides/sign-in-with-chatgpt.md)). OpenAI's Sign in with ChatGPT terms tie a plan to the person who owns it and require their tokens to stay on a machine they control, so one admin's plan cannot pay for every member's turns. The ChatGPT plan is a personal-use option. Companies do not get it: a workspace admin provides an LLM through an API-key provider (an organisation's own key may be shared by its members). Phase 3 moves API-key providers and model selections to the workspace and leaves the ChatGPT plan's "whose plan pays" rules as they are.

### AI models and secrets (phase 3d)

Migration `WorkspaceScopeAiModelsSecrets1763900000000` adds `workspace_id` to `ai_providers`, `ai_model_selections`, `ai_provider_connections`, `ai_provider_authorization_attempts` and `secrets`.

- **Migration: everything moves to the default workspace, with nothing to merge.** Before 3d there was no per-person setup of API-key providers or model choices. Providers, selections and secrets were rows with no owner, one set per installation. The only per-person rows were ChatGPT plan connections and unfinished sign-ins, and they belong to a provider that moves with them. So there are no duplicates to resolve.
- **Uniqueness per workspace.** One selection per (`workspace_id`, `job`) (the primary key), at most one ChatGPT plan provider per workspace (`UQ_ai_providers_workspace_chatgpt_subscription`), and secret names unique per workspace (`UQ_secrets_workspace_name`).
- **References stay inside the workspace.** A selection's provider, a provider's secret (`secretId` or a stored API key) and a thread's own provider are looked up in the same workspace. Another workspace's id answers "not found" (404).
- **Server credentials are the default workspace's only.** Google settings from the server environment (`GOOGLE_API_KEY` and the other Google key variables, `GOOGLE_CLOUD_PROJECT`/`LOCATION`, application default credentials, `GOOGLE_VERTEX_API_KEY`) belong to the installation, so they are only a fallback for providers in the default workspace (`mayUseServerCredentials` in `ai-providers/google-environment.ts`). A provider in another workspace must store its own key, and for Vertex AI its own service account, project and location. Otherwise it is not configured. A workspace admin can set a provider's base URL, so a fallback would hand the server's key to whatever URL they choose. `AiProvidersService` resolves the fallback in one place (`getAiProviderConfigById`). The model factory, model listing and embeddings always pass the AI SDKs an explicit key (`requireApiKey`, `vertexSettings`), so no SDK reads one from the environment by itself. A stored Vertex credential is accepted only as a self-contained service account key and rebuilt from its allowlisted fields (`parseServiceAccount`); `external_account`, impersonation and other configurations that make GoogleAuth fetch credentials from the host are refused in every workspace, so writing a secret never reaches the server's files or metadata.
- **Only a workspace admin changes them.** Creating, editing or deleting a provider, setting or clearing a model selection, and every secret write, including reading a secret's value, need `user:admin` as well as the module scope. The web session gets `user:admin` from the membership role in its workspace. Members can read providers and selections, because their threads use them, and can list secret names. The UI shows Settings → AI models as read-only to them.
- **ChatGPT plan connections stay per person.** A connection is (provider, person), and the provider is in one workspace. So a person in two workspaces connects in each one separately, and a connection only pays for turns in its own workspace. `ChatgptConnectionsService.authorizeTurn(workspaceId, …)` finds the provider in the turn's workspace, and uses a connection only if its person is still a member there. Connecting needs only `ai_provider:connect`, which any member has: it is the person's own plan, not the workspace's. The "whose plan pays" rules are unchanged (see [Sign in with ChatGPT](../how-to-guides/sign-in-with-chatgpt.md)).
- **Seeding.** At startup the default OpenAI and Google Vertex AI providers are created in the default workspace only. A new workspace gets the same two, with no credentials (see [Creating a workspace](#creating-a-workspace)).
- **Not changed:** no composite foreign keys (as in 3b). Same-workspace references are enforced by the services. Nothing in these modules is realtime.

## Admin roles

Two roles, and they are independent:

- **Workspace admin**: the `admin` membership role. Manages that workspace's members and settings. The web session's `user:admin` scope comes from the membership role in the token's workspace (`WebAuthService.generateWebAccessToken`). A person can be admin in one workspace and member in another.
- **Installation operator**: whoever runs the installation, i.e. people with `users.role = 'admin'`. Their web sessions also carry `installation:admin` (`auth/core/scopes/installation.scopes.ts`, a sensitive web scope that no session gets just for signing in). It creates workspaces, manages logins (`/auth/users`, which checks `users.role`), reviews access requests, and writes search settings. These routes are `installation` mode, so an operator uses them from any workspace.

Since phase 4, `users.role` never changes a workspace role (`updateUserRole` only sets the installation role). The first person (onboarding) is both: operator and admin of the default workspace. A person created from `/auth/users` joins the operator's current workspace, as its admin if they are made an operator too, a member otherwise.

Both scopes are decided when a token is minted, so a change applies at the next sign-in, refresh or switch.

## Many workspaces (phase 4)

### Creating a workspace

`POST /workspaces` (`installation:admin`) takes a `name` and a `slug`, unique across the installation (`409` otherwise). The operator becomes its first admin. `WorkspaceAdminService.provision` seeds what every workspace starts with:
- the system tags
- the built-in agents (`SEEDED_AGENTS` in `apps/backend/src/app-init/agent/seeded-agents.ts`), the same set the default workspace starts with: the `taico` agent, which runs the workspace's threads, and the developer, code reviewer, planner, shipper and other agents. Re-running `provision` on a workspace leaves a built-in agent its admins deleted deleted.
- the OpenAI and Google Vertex AI providers, without credentials

The providers stay unconfigured until a workspace admin adds a key, because installation credentials are the default workspace's only (see [phase 3d](#ai-models-and-secrets-phase-3d)). The seeded prompt blocks and MCP servers stay in the default workspace, and so does the startup prompt sync (built-in agents moved to the current seeded prompt). Workspaces created before every built-in agent was seeded have only `taico` until someone creates the others. Every workspace sees Taico's baseline servers (see [phase 3e](#github-mcp-registry-and-search-phase-3e)).

There is no rename or delete yet.

### Members

Members are always the token's workspace's: the routes are `/workspaces/current/members`, with no workspace id in the URL.

| Route | Who | What |
|---|---|---|
| `GET /workspaces` | anyone signed in | Your workspaces, your role in each, and which one the token is for (`current`). |
| `GET /workspaces/current` | members | The token's workspace and your role. |
| `GET /workspaces/current/members` | members | People and agents. |
| `POST /workspaces/current/members` | workspace admin | Invite by email, with a role. |
| `PATCH /workspaces/current/members/:actorId` | workspace admin | Change a person's role. |
| `DELETE /workspaces/current/members/:actorId` | workspace admin | Remove a person. |

- **Invite by email.** A person with an account is added (`accountCreated: false`), or `409` if already a member. Anyone else gets an invited account: installation role `standard`, member of this workspace only (`accountCreated: true`). They set a password through the usual account setup (`/auth/setup-account`) and then sign in. The response shows the person's name, so an invite tells a workspace admin whether an email already has an account.
- **The last admin** can be neither demoted nor removed (`409 WORKSPACE_LAST_ADMIN`). Role changes and removals lock the workspace row, so two at once can't both pass the check.
- **Agents** are not invited, re-roled or removed here (`400 WORKSPACE_MEMBER_IS_AGENT`). An agent is created in its workspace and leaves it by being deleted.
- **An actor who is not a member** of the token's workspace answers `404`, whether they exist elsewhere or not.
- **Removing a member** takes effect at their next token. Tokens already minted stay valid until they expire, and that includes open WebSocket connections:
  - web sessions: `WEB_ACCESS_TOKEN_DURATION_MINUTES`
  - MCP tokens: `mcpAccessTokenDurationSeconds`
  - issued agent tokens: their own lifetime

  After that, a refresh or switch lands in another of their workspaces. A person in no workspace gets no session at all (`403 NO_WORKSPACE_MEMBERSHIP` at sign-in and refresh). Refresh tokens, MCP refreshes and ChatGPT plan turns all check membership again.

### Switching

`POST /auth/web/switch-workspace { workspaceId }` needs a web session (the access-token cookie, verified as a session token). It checks that the person is a member of the workspace (`404 NOT_IN_WORKSPACE` otherwise, including for ids that don't exist). It then mints a new access token and refresh token for it, and revokes the refresh token in the request's cookie.

- **Refresh keeps the workspace.** `refresh_tokens.workspace_id` (migration `RefreshTokenWorkspace1764100000000`) records the session's workspace. Each refresh checks membership again. If the person was removed, the new token is for their oldest remaining workspace.
- **Sign-in** starts in the person's oldest membership. There is no "last used workspace" yet.
- **No token without a workspace.** Web sessions and MCP tokens for Taico's own servers always carry `workspace_id`. Someone in no workspace is refused, because a token with no claim would be read as the default workspace.
- MCP tokens for Taico's own servers are for the person's oldest membership. There is no workspace picker in the MCP OAuth flow yet.

The tests are in `test/workspace-membership.e2e-spec.ts`:
- creating a workspace and what it is seeded with
- the operator scope
- invites, new and existing
- role changes and the last admin
- removal and what the next token is for
- switching, including refusal for non-members
- refresh keeping the workspace
- agents created in the caller's workspace

**Still open after phase 4:**
- Removal does not revoke tokens already minted or disconnect sockets.
- The legacy fallback for tokens with no `workspace_id` claim remains (see the [launch checklist](https://taico.app/context/block/64d3ec50-6657-4cc3-98ca-25f5a4303c1f)).
- GitHub and MCP registry writes still need only module scopes, not workspace admin.

## The UI (phase 5)

The UI lives in `apps/ui/src/features/workspaces/`. `WorkspacesProvider` (inside `ProtectedRoute`) loads `GET /workspaces` once and gives every page the person's workspaces, the current one and `isWorkspaceAdmin`.

- **Switcher.** At the top of the desktop sidebar and the mobile drawer. It shows the current workspace, and becomes a picker when the person is in more than one. Choosing one calls `POST /auth/web/switch-workspace` and then **reloads the page** (`switchWorkspaceAndReload`). Every provider, cache and socket was loaded with the old session's workspace, so a full reload is the one way to be sure nothing from it stays on screen.
- **Startup gate.** `WorkspacesProvider` resolves the session's workspace (`GET /workspaces`) before anything workspace-bound mounts. It pins that workspace for the request header (`setShownWorkspace`) before the render that mounts children, so the first request of every provider, page, composer and socket (actors, threads, tasks, …) already carries it, and drafts load synchronously in the right scope. If the workspace can't be resolved, or the session is in none, the app doesn't start: it shows an error with a retry, so no request goes out without the header. A later list refresh that finds the session in a different workspace reloads the page instead of adopting it.
- **Other tabs.** Session cookies are shared by every tab, so a switch in one tab moves them all. `workspaceSession.ts` keeps each tab honest in three ways. (1) Every same-origin `/api/` request carries the workspace the page shows in `x-taico-workspace`. `AccessTokenGuard` refuses it with `WORKSPACE_CHANGED` (409) when the token is for another workspace, and the page reloads, so a stale tab can't read or write in a workspace it doesn't show. Requests without the header (API clients, MCP, workers) are unaffected. (2) The switching tab announces it on a `BroadcastChannel` and the other tabs reload. (3) A tab coming back to the foreground re-checks `GET /workspaces/current`, which catches tabs that were asleep.
- **Drafts.** `useDraftState` stores drafts under `draft:<actorId>:<workspaceId>:<key>` (`DraftScopeContext`, set by `WorkspacesProvider`) and loads nothing until both are known. A draft typed in one workspace never appears in another. Drafts saved before scoping (`new-task-draft`, `thread-chat-draft-*`, …) are deleted on load rather than imported into whichever workspace is open.
- **Settings > Workspace** (`/settings/workspace`). The current workspace's people and agents. Workspace admins invite by email, change roles and remove people. Agents are listed but managed on the Agents page.
- **Settings > Workspaces** (`/settings/workspaces`). Your workspaces, each with Switch. Installation operators (`users.role = 'admin'`) also create workspaces here.
- **Who edits what.** Pages about the workspace's shared settings decide from the workspace role (`isWorkspaceAdmin`), never from `user.role`. Settings > AI models is read-only for members, except their own ChatGPT plan connection and Test connection. `user.role` is still right for the installation operator's pages: Users, Access requests and creating workspaces.
- **Links into another workspace.** A task, thread or context block that answers "not found" is looked up with `GET /workspaces/locate?kind=task|thread|context_block&id=` (`installation` mode). When it is in another of the person's workspaces, the page offers "Switch to <workspace>", which switches and reopens the same URL. The route answers the same `404` when the row does not exist, is deleted, or is in a workspace the person is not in, so ids cannot be probed. The kind maps to a fixed table name in `WorkspacesService.locateRowForActor`; it never reaches SQL as client input.

Not yet: other link targets (agents, projects, runs), and a workspace picker in the MCP OAuth flow. A background tab's socket that reconnects after another tab switched can receive the new workspace's events until that tab is focused or makes a request. Socket messages are subscriptions only, so it can't write. The Tasks board's selected and recent projects (`tasks.selectedProjectId`, `tasks.recentProjectIds`) are not scoped by workspace. They hold ids only, and the other workspace can't resolve them.

## Phases

Each phase ships on its own and leaves a working single-workspace installation. Phases 2–5 are tracked as Taico tasks named "Workspaces phase N: …"; phase 3 is split into 3a–3e by module.

1. **Workspace and membership** (done). `workspaces`, `workspace_members`, the default workspace, every actor a member, `workspace_id` in every minted token.
2. **Request context** (done). `@CurrentWorkspace()` from the token (default workspace when the claim is missing), WebSocket and MCP context, `user:admin` from the membership role.
3. **Scope the data**, module by module (3a, tasks, context and meta: done; 3b, threads: done; 3c, agents, executions and workers: done; 3d, AI models and secrets: done; 3e, integrations, MCP registry and search: done; see [How to scope a module](#how-to-scope-a-module-the-phase-3-pattern)): add `workspace_id`, backfill to the default workspace, make it `NOT NULL`, scope every query, make uniqueness per workspace, prefix realtime rooms. Suggested order: meta/context, tasks, threads, agents and agent runs, executions and workers, AI providers and secrets, integrations, MCP registry, search. Each module gets e2e tests that a second workspace cannot see or touch the first one's rows.
4. **Many workspaces** (done, see [Many workspaces](#many-workspaces-phase-4)). Create a workspace, invite and remove members, switch workspace (`POST /auth/web/switch-workspace`), installation operator scope, agents created in the caller's workspace, remove the membership subscriber.
5. **UI** (done, see [The UI](#the-ui-phase-5)). Workspace switcher, workspace settings and members page, operator page to create workspaces, workspace role on AI models, the "switch workspace?" prompt on links from another workspace.
