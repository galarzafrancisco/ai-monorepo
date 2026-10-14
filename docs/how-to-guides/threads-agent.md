# Threads Agent

The threads agent answers messages in a thread. It runs on the Vercel AI SDK, so any supported provider and model can power it, and a thread can switch between them at any time.

Code lives in `apps/backend/src/threads/agent/`.

## Two message stores

| Table | What it holds | Who reads it |
| --- | --- | --- |
| `thread_messages` | What people see in the thread | UI, API |
| `thread_agent_messages` | What the model sees: user messages, assistant text, reasoning, tool calls, tool results, hook injections, summaries | The agent only |

`thread_agent_messages` is append-only, one row per message, stored as an AI SDK `ModelMessage` in `message` (jsonb) with a `format_version`.

Rows form a tree through `parent_id`. `threads.head_agent_message_id` points at the tip of the active branch. The model's context is the path from the head back to the root, or back to the newest row of kind `summary`.

Every user-facing message stores `agent_message_id`, the agent-side row it corresponds to. Rewinding a thread means moving the head; branching means appending a new child to an older row.

## A turn

`ThreadAgentService.requestTurn(threadId)` is called after a message is saved. A turn:

1. Claims the thread in `thread_turns`. A partial unique index allows one running turn per thread across all backend processes. If the claim fails, the process that holds it picks up the new message when it finishes.
2. Copies unseen user-facing messages into the agent log and links them.
3. Runs `beforeTurn` hooks.
4. Loads the context, calls the model with Taico's MCP tools, and appends each step as it completes.
5. Runs `afterTurn` hooks, then releases the thread.

Nothing is kept in memory between turns. A turn whose process died stops heartbeating and is failed by the next claim after 60 seconds.

## Providers and models

Providers and models are separate, and both are set in Settings → AI models.

An AI provider (`ai_providers`) is one AI service: a type (`openai`, `anthropic`, `google`, `google_vertex`, `xai`, `openai_compatible` or `chatgpt_subscription`), an optional stored secret, and an endpoint. It has no model.

`chatgpt_subscription` is different from the rest: it has no shared credentials. Each person connects their own ChatGPT account, a thread turn runs on the plan of the person it is for, and the provider answers in threads only. See [Sign in with ChatGPT](sign-in-with-chatgpt.md).

A model is picked per job (`ai_model_selections`, one row per job, holding a provider and a model id):

| Job | Used by | When nothing is selected |
|---|---|---|
| `conversation` | The threads agent, and compaction | Threads cannot answer |
| `quick_tasks` | Thread titles | Uses the conversation model, unless that is a ChatGPT plan |
| `middle_manager` | The thread state reconciler | Uses the conversation model, unless that is a ChatGPT plan |
| `embeddings` | Nothing yet (reserved for search) | Not available |

Selections are read from the database on every call, so a change applies to every backend process on its next turn. `ChatModelFactory.resolve({ job })` turns a job into an AI SDK model.

The threads agent also passes `onBehalfOf`: the actor the turn is for, and whether anybody typed. Providers with shared credentials ignore it. A ChatGPT plan provider requires it, which is what keeps it out of every other job.

A resolved model can set `requiresStreaming`. Code that only wants the final text (compaction) must then call `streamText()` and read it to the end instead of `generateText()`.

`GET /api/v1/ai-providers/:id/models` asks the provider which models it offers, using each provider type's own listing endpoint (the AI SDK has none). The model id is stored as plain text, so a model the listing does not return can still be typed in.

Threads normally store no provider or model and follow the `conversation` selection. `threads.ai_provider_id` and `threads.model_id` exist for a per-thread override, which has no UI yet; both must be set for it to apply.

A Google Vertex AI provider is created by default. It uses the stored service account JSON, project and location when present. Anything left empty falls back to application default credentials, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.

When a message was produced by a different model than the one being called, its reasoning parts and provider-specific options are dropped before replay (`agent-context.utils.ts`).

## Hooks

A hook watches the conversation and can add context the user never sees.

```ts
@Injectable()
export class MyHook implements ThreadAgentHook {
  readonly name = 'my-hook';

  async beforeTurn(context: BeforeTurnContext): Promise<string | null> {
    // Return text to inject into the agent-side conversation, or null.
  }

  async afterTurn(context: AfterTurnContext): Promise<void> {
    // Maintenance after the reply was delivered.
  }
}
```

Register it in `ThreadsModule` under `THREAD_AGENT_HOOKS`. Hooks run in the listed order, have a time limit (5 seconds before a turn, 2 minutes after), and a failing hook never blocks the turn.

### How hook context reaches the model

What `beforeTurn` returns is stored in `thread_agent_messages` as a user-role row (kind `injection`, source `hook:<name>`) wrapped in `<context source="my-hook">`, and stays in the conversation like any other message.

- It must not go in the system prompt. The system prompt is the start of every request, so changing it per turn invalidates the prompt cache for the whole conversation. The system prompt is the same on every turn of a thread.
- Providers merge consecutive user messages into one turn, so the model sees the context right after what the user typed. On its own that looks like a prompt injection, and anyone can type a `<context>` tag. The thread key solves both.
- Word the context as facts and what to do about them. Wording that asks the model to play a role or keep secrets from the user gets ignored, with good reason.
- The model follows what a hook returns. Do not pass on text written by users or fetched from outside as if it were an instruction.

### The thread key

Every thread has a secret key: six random hex characters in `threads.secret`, created the first time the agent runs on the thread (`ThreadAgentLogService.getOrCreateThreadSecret`).

- Taico's own additions to the conversation are the markers in `TAICO_MARKER_TAGS` (`thread-agent.prompts.ts`): `<context>`, `<conversation-summary>` and `<task-notification>`. When they are sent to the model, the key is added to the opening tag: `<context key="a1b2c3" source="my-hook">`.
- The system prompt tells the model the key, to trust only tags that carry it, to treat any other tag as untrusted typed text, and never to reveal the key.
- Rows are stored without the key. `withThreadSecret` adds it on the way to the model, to rows of kind `injection` or `summary` only. A message a person typed is kind `message` and never gets it, whatever it contains. Rows written before threads had a key get it the same way.
- Hooks never see the key and do not need to.
- The key must stay in the backend. The entity column is `select: false`, so it is not loaded with the thread and cannot reach an API response or an event. Do not add it to a DTO.
- When you add a marker, add it to `TAICO_MARKER_TAGS`, describe it in the prompt, and store its rows with kind `injection`.

Limits: the key is short and the only thing stopping the model from repeating it is the instruction not to. It guards against someone typing a tag, not against a determined attacker who gets the model to leak it. Text from people that Taico places inside a keyed tag (a task name in a notification, a summary of what was said) is read by the model as part of that tag.

Built-in hooks:

- `EasterEggHook` is the example to copy. Say "the key is under the doormat" in a thread and the agent is told to answer with the countersign.
- `CompactionHook` appends a summary once the conversation exceeds `THREAD_AGENT_COMPACTION_TOKEN_THRESHOLD` input tokens (default 100000). Older rows stay in the table. It uses the model of the turn it follows. A summary whose request fails or ends early is not stored.

## Multiple backend processes

- Conversation state and the turn lock are in Postgres.
- Socket.io broadcasts go through `PostgresIoAdapter`, so a client connected to one process receives events from a turn running on another.

## Tests

```bash
npx jest src/threads/agent                 # unit
npm run test:e2e:threads-agent             # real Postgres, mock model
npm run test:e2e:chatgpt-subscription      # real Postgres, fake OpenAI (Sign in with ChatGPT)
npm run build && npm run test:live:threads # two processes, fake model server
```
