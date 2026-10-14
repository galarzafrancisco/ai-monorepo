# Sign in with ChatGPT (ChatGPT plan provider)

Lets the threads agent (and, if selected, user small tasks and the middle manager) run on a person's own ChatGPT plan instead of an API key. It is an AI provider type (`chatgpt_subscription`), set up in Settings → AI models next to the API-key providers.

It is not a way to log in to Taico. A Taico user signs in to Taico as before, then connects a ChatGPT account to their user. Taico's own users, authentication and scopes are unchanged.

> **Status: not yet run against OpenAI.** This was built from OpenAI's documentation and is tested against a fake OpenAI server (`apps/backend/test/helpers/fake-openai.ts`). Before relying on it, do the manual check at the end of this page with a real account.

## Where it may be used

OpenAI's Sign in with ChatGPT terms require that a person's tokens are stored on a machine that person controls, and that requests come from that machine. So:

- **Allowed:** a Taico you run yourself, locally or on your own server.
- **Not allowed without OpenAI's separate approval:** a hosted Taico that an operator runs for other people. Do not turn this on there.

The feature is off by default. Setting `CHATGPT_SUBSCRIPTION_ENABLED=true` is the operator stating that the deployment is the allowed kind. Taico cannot verify that for you.

It also needs encrypted secret storage: `SECRETS_ENABLED=true` and a `SECRETS_ENCRYPTION_KEY`. Plaintext mode (`ALLOW_PLAINTEXT_SECRETS_INSECURE`) is refused for these tokens.

| Variable | Default | Meaning |
|---|---|---|
| `CHATGPT_SUBSCRIPTION_ENABLED` | off | Turns the provider type on |
| `CHATGPT_SUBSCRIPTION_CALLBACK_PORT` | `1456` | Port in the redirect address `http://127.0.0.1:<port>/auth/callback`. Nothing listens on it (see [The sign-in flow](#the-sign-in-flow)) |

## What a person sees

1. An admin adds a provider of type **ChatGPT plan** and picks it as the Conversation model, and optionally as the User small tasks and Middle manager models. System small tasks need a provider with an API key. There is one such provider per installation and it holds no account.
2. Each person clicks **Continue with ChatGPT** on that provider. OpenAI opens in a new tab. They approve there; the tab then shows a "can't be reached" page at `http://127.0.0.1:1456/auth/callback?…`. They copy that whole address, paste it under **Finish signing in** in the Taico tab, and click **Finish**: "You're using your ChatGPT plan."
3. Settings shows which account is connected, **Manage usage** (ChatGPT's usage page), **Reconnect** and **Disconnect**. Threads show "Using ChatGPT plan" next to the model.
4. Disconnect revokes the grant at OpenAI and deletes everything stored about the account.

The model list on this provider is the list of the signed-in person's own account, in OpenAI's order, without hidden models.

## Whose plan pays for a turn

| Turn started by | Plan used |
|---|---|
| A message a person wrote | That person's. With several unanswered messages, the author of the newest one |
| A task update (nobody typed) | The person the agent subscribed for, and only if they turned on "Also answer task updates on my plan" |
| An agent's message | None. The turn fails |
| The middle manager (thread state reconciler) | The person who **created the thread**, and only if they turned on "Also answer task updates on my plan". Never the person or agent who changed the task |
| User small tasks: a title from a thread's first message, written by a person | The person who **wrote that message** |
| User small tasks: a title from the parent task, for a thread a person created | The person who **created the thread** (they just did it, so no extra consent) |
| System small tasks: any title an agent triggered (e.g. creating a subtask) | None, ever. Runs on the System small tasks model, which must use an API key |

Only that one person's connection is looked up. If it is missing, expired, or lacks plan access, the turn fails and the thread shows why. Taico never uses someone else's plan and never falls back to another provider, including an API-key provider that is configured.

Other people's earlier messages in the thread are still part of the conversation that is sent, as with any provider.

A failed turn has already taken in the messages that started it, so the agent sees them on the next turn. This is how every failed turn behaves, not something specific to this provider.

## Which jobs

A provider of this type:

- can be selected for the `conversation`, `user_small_tasks` and `middle_manager` jobs and no others (`PUT /ai-model-selections/system_small_tasks` or `/embeddings` answers `AI_PROVIDER_JOB_NOT_ALLOWED`). The list is `USER_CONNECTED_PROVIDER_JOBS` in `enums/ai-model-job.enum.ts`;
- is never inherited. `user_small_tasks`, `system_small_tasks` and `middle_manager` normally follow the conversation model; with this provider as the conversation model they count as "not selected" until they get a model of their own. For user small tasks and the middle manager that can be this same provider, selected directly; system small tasks need an API-key provider, and Settings shows a warning until they have one;
- is refused by `ChatModelFactory` unless the caller says whose plan pays (`onBehalfOf`). Only `ThreadAgentService` (the person the turn is for), `ThreadStateReconcilerService` via `ChatService.runTask` (the thread's creator) and `ThreadTitleService` via `ChatService.generateText` for user small tasks (see below) do. The factory also refuses a user small task marked `automated`, and every system small task.

### Small tasks (thread titles)

Thread titles are the only small task today. There are two jobs, and `ThreadTitleService` picks one from the actor who triggered the title:

- **User small tasks** (`user_small_tasks`): a person triggered it. That covers a thread they created with a parent task (`POST /threads`) and the first message they wrote. The call names that person (`onBehalfOf`, `automated: false`), so on this provider it runs on their plan and nobody else's. It needs no "Also answer task updates on my plan" consent, because they just acted. An unattended call (`automated: true`) is refused.
- **System small tasks** (`system_small_tasks`): no person triggered it. That covers a thread created when an agent creates a subtask (`TasksService.createTaskInThread`), an agent calling `POST /threads`, and a first message an agent wrote. This job never runs on a person's plan: the selection, the resolver and `ChatModelFactory` all refuse this provider. It needs an API-key provider, either selected directly or followed from an API-key conversation model. Without one, Settings → AI models shows a warning on the job. Each such title is also logged at warn level as `Text generation failed` with `AI_MODEL_NOT_SELECTED` and how to fix it, and the thread keeps "New thread".

If a user small task cannot use that one person's plan (not connected, needs to sign in again, no plan access, usage limit, a failed or incomplete stream), the thread keeps its default title and a warning is logged with the error code and, for OpenAI failures, `upstreamCode`. Nothing falls back to another provider or to system small tasks, and nothing is shown in the thread.

The call streams (`streamText()` read to the end, with `stream: true` and `store: false`), as this provider requires. Text that arrived before a failure is thrown away.

### The middle manager

The thread state reconciler only runs because a task changed, so nobody typed and every run is unattended (`automated: true`):

- It runs on the plan of the thread's creator (`threads.created_by_actor_id`). The person whose change triggered it is not used: it is usually an agent, and their plan would pay for someone else's thread.
- The creator must have turned on "Also answer task updates on my plan". The same consent covers unattended thread turns and middle manager runs.
- If the creator is an agent, is not connected, needs to sign in again, or has not given that consent, the run fails and is logged as a warning (`Thread state reconciliation failed`). The thread's shared notes are not updated. Nothing falls back to another provider, and nothing is shown in the thread.
- The run streams (`streamText()` read to the end), as this provider requires. A failed stream fails the run.
- A thread's own provider and model (`threads.ai_provider_id`) only apply to the conversation. The middle manager always uses the `middle_manager` selection.

Compaction is part of a thread turn. It runs after the reply, on the same person's connection as the turn. When the turn was a task update, the consent for task updates covers it.

A per-thread provider and model (`threads.ai_provider_id`, `threads.model_id`) work the same way as the global selection.

## The sign-in flow

Taico is a public OAuth client of OpenAI here. This is separate from Taico's own authorization server (`authorization-server/`), which issues tokens to Taico's clients; none of that code is involved.

1. `POST /ai-providers/:id/connection/authorize` creates a state, a nonce and a PKCE verifier, stores them (state hashed, verifier encrypted) in `ai_provider_authorization_attempts` together with the redirect URI, and returns OpenAI's authorization address. The UI opens it in a new tab and keeps settings open.
2. The first sign-in uses OpenAI's shared client `dynamic_agent_client`; the redirect brings back a client id issued for this installation (`oaiapp_…`), which is stored and used from then on.
3. OpenAI redirects the browser to `http://127.0.0.1:<CHATGPT_SUBSCRIPTION_CALLBACK_PORT>/auth/callback?code=…&state=…`. **Nothing listens there**, so the browser shows an error page. That is expected.
4. The person copies the address from the address bar and pastes it under **Finish signing in**. The UI posts it as `callbackUrl` to `POST /ai-providers/:id/connection/callback` as the signed-in user. Only the Taico user who started the sign-in can finish it, once, within 10 minutes. The pasted address must be the redirect URI the attempt was started with (scheme, host, port and path); otherwise the attempt is used up and nothing is exchanged.
5. The backend exchanges the code (repeating the stored redirect URI and the PKCE verifier), verifies the ID token (signature, issuer, audience, expiry, nonce), and stores the connection. Without the `chatgpt.tokens.use.direct` scope the account is recorded but no plan requests are made.

### Why the address is pasted

OpenAI accepts only `http://127.0.0.1:<port>/auth/callback` as the redirect for this kind of client: the host and path are fixed and only the port may vary. Taico normally runs in a container or on another machine, so `127.0.0.1` in the person's browser is never the Taico backend. Earlier versions opened a temporary listener on the backend's own `127.0.0.1` and forwarded the browser to the UI; it only worked when the browser and backend shared a machine, so it was removed. Pasting works the same in every deployment.

Redirect configuration:

- There is nothing to register at OpenAI and no port to expose or forward. The redirect URI is sent with each authorization request and repeated in the code exchange.
- `CHATGPT_SUBSCRIPTION_CALLBACK_PORT` (default `1456`) only changes the port in that address. Change it if something on people's computers already answers on `1456`: whatever answers would receive the redirect (the code is useless without the verifier held by Taico, but the person would not see the expected error page). Invalid values fall back to `1456`.
- Changing the port while a sign-in is in progress makes that sign-in fail; start again.

The authorization code appears in the pasted address and in the request body to the callback endpoint. It is not logged and never returned in a response.

## What is stored

`ai_provider_connections`, one row per provider and Taico user:

- the issued client id, the verified issuer and subject, the account email (for display), granted scopes, access-token expiry;
- the access, refresh and ID tokens as one AES-256-GCM value (`SecretsEncryptionService`). The column is not selected by default and appears in no API response, event or log;
- when the person allowed task updates, and the last error OpenAI returned.

The browser sees the authorization code in the redirect, as in any OAuth flow, and nothing else. `ai_providers.host_id` holds a random id of the installation that OpenAI asks for; it identifies no person.

Access tokens last an hour and are refreshed a minute before they expire. A refresh returns a new refresh token; the row is locked during the exchange so two backend processes cannot spend the same one. If OpenAI says the grant is gone, the tokens are cleared and the person is asked to sign in again; that sign-in must be the same ChatGPT account. A temporary failure keeps the connection.

## Requests to OpenAI

Inference goes to `POST https://api.openai.com/v1/responses` with the person's OAuth token, and nowhere else. `chatgpt-responses.model.ts` wraps the AI SDK's OpenAI Responses model so that every request:

- has `stream: true` and `store: false`, and carries the whole conversation in `input` (no `previous_response_id`, no `conversation`);
- has none of the fields the plan rejects (`temperature`, `max_output_tokens`, `metadata`, `user`, …);
- sends instructions as a developer message, never a system input item;
- has its function tools inside one namespace, `taico`.

A non-streaming call (`generateText`) throws before anything is sent. `ResolvedChatModel.requiresStreaming` tells callers such as compaction to use `streamText()` and read it to the end.

An answer counts only when the stream ends with `response.completed`. `response.failed`, `response.incomplete`, an `error` event and a connection that closes early all fail the turn, even after some text arrived. Nothing is retried automatically.

| OpenAI says | What the thread shows |
|---|---|
| `subscription_sharing_usage_limit_exceeded` | Plan limit reached, with the link to ChatGPT's usage page. Settings makes "Manage usage" the main action |
| `subscription_sharing_usage_unavailable`, `…_user_unavailable` | Temporarily unavailable; the connection is kept |
| `subscription_sharing_user_not_eligible` | The account cannot use its plan in other apps |
| `subscription_sharing_unsupported_capability` | Something in the request is not supported; not sent again |
| Refresh failed for good | Sign in again |

Every one of these ends with the statement that no other provider was used.

## Code map

```
apps/backend/src/ai-providers/
├── ai-provider-connection.entity.ts            # a user's own authorization to use a provider
├── ai-provider-authorization-attempt.entity.ts # sign-ins in progress
├── ai-provider-connections.controller.ts       # /ai-providers/:id/connection
└── chatgpt-subscription/
    ├── chatgpt-oauth.client.ts                 # authorize URL, token, refresh, revoke, ID token
    ├── chatgpt-connections.service.ts          # lifecycle, token rotation, who may use a plan
    ├── chatgpt-responses.model.ts              # the guarded Responses model
    ├── chatgpt-subscription.service.ts         # model for a turn, model catalog
    └── chatgpt-subscription.errors.ts          # OpenAI codes → messages
```

The connection table and routes are not specific to OpenAI. The rule "a provider that runs on a person's plan answers that person's thread turns only" is keyed on `USER_CONNECTED_PROVIDER_TYPES` in `enums/ai-provider-type.enum.ts`.

## Tests

```bash
cd apps/backend
npx jest src/ai-providers/chatgpt-subscription src/threads/agent   # unit
npm run test:e2e:chatgpt-subscription                              # real Postgres, fake OpenAI
```

The end-to-end spec runs the whole flow against `FakeOpenAi`, which checks PKCE, the exact redirect URI and refresh-token rotation the way OpenAI does. It covers the sign-in and its failure cases, token storage, per-person isolation, model listing, job scope, user/system small-task routing, a full thread turn with streaming and a tool call, refresh races, usage limits, compaction, disconnect and provider deletion. It is part of `npm run test:e2e`, which CI runs.

## Manual check with a real account

1. In your stack's env file set:
   ```bash
   SECRETS_ENABLED=true
   SECRETS_ENCRYPTION_KEY=<output of: openssl rand -hex 32>
   CHATGPT_SUBSCRIPTION_ENABLED=true
   ```
   and remove `ALLOW_PLAINTEXT_SECRETS_INSECURE`. Changing the secrets mode makes secrets stored earlier in plaintext unreadable, so use a fresh database or re-enter API keys.
2. `npm run dev`, open the UI in a browser (any machine).
3. Settings → AI models → Add provider → **ChatGPT plan** → **Continue with ChatGPT**, approve in the new tab, then paste the `http://127.0.0.1:1456/auth/callback?…` address from that tab under **Finish signing in** and click **Finish**.
4. Pick the provider and a model for **Conversation**, then write in a thread. Ask for something that needs a tool, such as "list my tasks".
5. Check: the reply streams in, the thread header says "Using ChatGPT plan", and ChatGPT's usage page shows the usage.
6. Click **Disconnect**, write again, and check that the thread says you are not connected.

Things only this check can confirm, because the fake cannot: that OpenAI accepts the request shape (tools in a namespace, developer message), the exact shape of the model catalog, and the wording of the consent screen.

## Limits

- Not yet run against the real service (see the top of this page).
- A turn nobody typed is covered end to end only as far as the consent decision; the path from a task change to that decision is covered by unit tests.
- The usage limit is not remembered as a pause: each new message makes one request, which OpenAI refuses until the plan resets. OpenAI gives no reset time to wait for.
- A disconnect made at OpenAI is not pushed to Taico. Taico notices on the next request or refresh.
- `isReady` in `GET /ai-model-selections` says the provider is turned on, not that the person asking has connected.
- A middle manager run or user small task that cannot use the person's plan only leaves a server log line. Settings does not show it, and the thread's shared notes silently stop updating.
- Threads created by an agent (for example by an agent creating subtasks) have no plan to run the middle manager on, so it never runs for them while this provider is selected. Their titles come from System small tasks, which use an API key.
