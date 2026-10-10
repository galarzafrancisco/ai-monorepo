# Thread AI runtime

Taico thread chat, thread title generation, and the thread state middle manager share the Vercel AI SDK backend. Chat and reconciliation use `ToolLoopAgent` to execute authenticated MCP tools over multiple steps; titles use tool-free `generateText`.

## Providers

Select the active provider in Chat Settings. Existing provider records and agent model IDs continue to work:

- `openai`: uses the AI SDK OpenAI Responses adapter and the API key stored in Chat Settings.
- `adk`: the existing API/database identifier now selects the AI SDK Google adapter. New installations display this provider as **Google AI**. It no longer starts an ADK runner.

Google AI accepts `GOOGLE_API_KEY` (the existing configuration) or `GOOGLE_GENERATIVE_AI_API_KEY`. To use Vertex AI, set `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`, and configure Google Application Default Credentials. The adapter also supports the SDK's `GOOGLE_VERTEX_PROJECT` and `GOOGLE_VERTEX_LOCATION` defaults.

The Taico agent's configured model ID overrides provider defaults. Defaults remain `gpt-5.4` for OpenAI and `gemini-3.6-flash` for Google. Choose a model appropriate to the active provider.

## History and tools

The `thread_chat_history` PostgreSQL table stores one row per AI SDK model message, including tool calls and results. Writes are append-only; each turn inserts only new messages. Reads assemble the SDK message array in database-assigned sequence order. A sequence provides deterministic ordering even when multiple messages in a batch share the same `created_at` timestamp; an index on `(thread_id, sequence)` supports these reads.

Registered migrations create the table automatically on startup. `AppendOnlyThreadChatHistory1791629000000` converts the initial per-thread arrays into individual rows while preserving their order and contents, including for installations that already ran the initial SDK migration. Conversation IDs are still allocated locally for legacy thread API compatibility, but streaming history is keyed exclusively by `threadId`; new threads do not create remote OpenAI conversations or ADK sessions.

On the first SDK turn of an existing thread, the visible thread transcript seeds the new history. Historical provider-only tool traces are not imported. Subsequent turns use the saved SDK history, including after restarts. Turns within each thread are serialized within the backend process to avoid concurrent history overwrites.

MCP tools retain the `tasks__` and `context__` prefixes used by thread instructions. Each run connects to the tasks and context MCP endpoints with the existing scoped ephemeral bearer token and closes both clients after success, failure, or stream cancellation. The middle manager uses the same tools and model selection without adding its internal prompt or output to chat history.

## Verification

```bash
npm run build:dev
npm -w apps/backend test -- --runInBand
npm run test:e2e
npm run dev:1
```

The backend tests exercise the real AI SDK tool loop with deterministic mock models, including streaming, tool execution, history migration, concurrent turns, provider selection, and failure cleanup.
