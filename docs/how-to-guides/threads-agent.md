# Threads Agent

The threads agent answers messages in a thread. It runs on the Vercel AI SDK, so any supported provider and model can power it, and a thread can switch between them at any time.

Code lives in `apps/backend/src/threads/agent/`.

## Two message stores

| Table | What it holds | Who reads it |
| --- | --- | --- |
| `thread_messages` | What people see in the thread | UI, API |
| `thread_agent_messages` | What the model sees: user messages, assistant text, reasoning, tool calls, tool results, a record of hook context, summaries | The agent only |

`thread_agent_messages` is append-only, one row per message, stored as an AI SDK `ModelMessage` in `message` (jsonb) with a `format_version`.

Rows form a tree through `parent_id`. `threads.head_agent_message_id` points at the tip of the active branch. The model's context is the path from the head back to the root, or back to the newest row of kind `summary`.

Every user-facing message stores `agent_message_id`, the agent-side row it corresponds to. Rewinding a thread means moving the head; branching means appending a new child to an older row.

## A turn

`ThreadAgentService.requestTurn(threadId)` is called after a message is saved. A turn:

1. Claims the thread in `thread_turns`. A partial unique index allows one running turn per thread across all backend processes. If the claim fails, the process that holds it picks up the new message when it finishes.
2. Copies unseen user-facing messages into the agent log and links them.
3. Loads the context and runs `beforeTurn` hooks.
4. Calls the model with Taico's MCP tools and whatever the hooks added, and appends each step as it completes.
5. Runs `afterTurn` hooks, then releases the thread.

Nothing is kept in memory between turns. A turn whose process died stops heartbeating and is failed by the next claim after 60 seconds.

## Providers and models

Providers and models are separate, and both are set in Settings → AI models.

An AI provider (`ai_providers`) is one AI service: a type (`openai`, `anthropic`, `google`, `google_vertex`, `xai` or `openai_compatible`), an optional stored secret, and an endpoint. It has no model.

A model is picked per job (`ai_model_selections`, one row per job, holding a provider and a model id):

| Job | Used by | When nothing is selected |
|---|---|---|
| `conversation` | The threads agent, and compaction | Threads cannot answer |
| `quick_tasks` | Thread titles | Uses the conversation model |
| `middle_manager` | The thread state reconciler | Uses the conversation model |
| `embeddings` | Nothing yet (reserved for search) | Not available |

Selections are read from the database on every call, so a change applies to every backend process on its next turn. `ChatModelFactory.resolve({ job })` turns a job into an AI SDK model.

`GET /api/v1/ai-providers/:id/models` asks the provider which models it offers, using each provider type's own listing endpoint (the AI SDK has none). The model id is stored as plain text, so a model the listing does not return can still be typed in.

Threads normally store no provider or model and follow the `conversation` selection. `threads.ai_provider_id` and `threads.model_id` exist for a per-thread override, which has no UI yet; both must be set for it to apply.

A Google Vertex AI provider is created by default. It uses the stored service account JSON, project and location when present. Anything left empty falls back to application default credentials, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.

When a message was produced by a different model than the one being called, its reasoning parts and provider-specific options are dropped before replay (`agent-context.utils.ts`).

## Hooks

A hook watches the conversation and can tell the model something the user never sees.

```ts
@Injectable()
export class MyHook implements ThreadAgentHook {
  readonly name = 'my-hook';

  async beforeTurn(context: BeforeTurnContext): Promise<string | null> {
    // Return text for the model, or null.
  }

  async afterTurn(context: AfterTurnContext): Promise<void> {
    // Maintenance after the reply was delivered.
  }
}
```

Register it in `ThreadsModule` under `THREAD_AGENT_HOOKS`. Hooks run in the listed order, have a time limit (5 seconds before a turn, 2 minutes after), and a failing hook never blocks the turn.

### Where hook context goes

What `beforeTurn` returns is added to the end of the system instructions of that turn, under "Context for this turn", wrapped in `<context source="my-hook">`. It is not sent as a message.

- It was a user-role message before. Providers merge consecutive user messages into one turn, so the model saw the context glued to what the user typed and treated it as a prompt injection.
- A system-role message in the middle of the conversation is not an option: Google rejects system messages anywhere but the start.
- It applies to one turn. Later turns do not see it, so a hook that wants something to persist returns it again. The row stays in `thread_agent_messages` (role `system`, kind `injection`, source `hook:<name>`) as a record, and `buildModelMessages` skips system rows.
- The model gives it the weight of the agent's own prompt. A hook must not pass text written by users or fetched from outside through unchanged. State facts and what to do about them in plain terms; wording that asks the model to play a role or keep secrets from the user gets ignored, with good reason.

Built-in hooks:

- `EasterEggHook` is the example to copy. Say "the key is under the doormat" in a thread and the agent is told to answer with the countersign.
- `CompactionHook` appends a summary once the conversation exceeds `THREAD_AGENT_COMPACTION_TOKEN_THRESHOLD` input tokens (default 100000). Older rows stay in the table.

## Multiple backend processes

- Conversation state and the turn lock are in Postgres.
- Socket.io broadcasts go through `PostgresIoAdapter`, so a client connected to one process receives events from a turn running on another.

## Tests

```bash
npx jest src/threads/agent                 # unit
npm run test:e2e:threads-agent             # real Postgres, mock model
npm run build && npm run test:live:threads # two processes, fake model server
```
