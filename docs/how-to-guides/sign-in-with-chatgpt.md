# Sign in with ChatGPT (ChatGPT plan provider)

Lets the threads agent answer on a person's own ChatGPT plan instead of an API key. It is an AI provider type (`chatgpt_subscription`), set up in Settings → AI models next to the API-key providers.

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
| `CHATGPT_SUBSCRIPTION_CALLBACK_PORT` | `0` (any free port) | Port of the sign-in listener on `127.0.0.1` |

## What a person sees

1. An admin adds a provider of type **ChatGPT plan** and picks it as the Conversation model. There is one such provider per installation and it holds no account.
2. Each person clicks **Continue with ChatGPT** on that provider, approves at OpenAI, and comes back to settings: "You're using your ChatGPT plan."
3. Settings shows which account is connected, **Manage usage** (ChatGPT's usage page), **Reconnect** and **Disconnect**. Threads show "Using ChatGPT plan" next to the model.
4. Disconnect revokes the grant at OpenAI and deletes everything stored about the account.

The model list on this provider is the list of the signed-in person's own account, in OpenAI's order, without hidden models.

## Whose plan pays for a turn

| Turn started by | Plan used |
|---|---|
| A message a person wrote | That person's. With several unanswered messages, the author of the newest one |
| A task update (nobody typed) | The person the agent subscribed for, and only if they turned on "Also answer task updates on my plan" |
| An agent's message | None. The turn fails |

Only that one person's connection is looked up. If it is missing, expired, or lacks plan access, the turn fails and the thread shows why. Taico never uses someone else's plan and never falls back to another provider, including an API-key provider that is configured.

Other people's earlier messages in the thread are still part of the conversation that is sent, as with any provider.

A failed turn has already taken in the messages that started it, so the agent sees them on the next turn. This is how every failed turn behaves, not something specific to this provider.

## Threads only

A provider of this type:

- can be selected for the `conversation` job and no other (`PUT /ai-model-selections/quick_tasks` answers `AI_PROVIDER_JOB_NOT_ALLOWED`);
- is not inherited by `quick_tasks` and `middle_manager`, which normally follow the conversation model. With this provider as the conversation model they count as "not selected": thread titles are skipped and the thread state reconciler does not run until they get a model of their own;
- is refused by `ChatModelFactory` unless the caller says who the turn is for, which only `ThreadAgentService` does.

Compaction is part of a thread turn. It runs after the reply, on the same person's connection as the turn. When the turn was a task update, the consent for task updates covers it.

A per-thread provider and model (`threads.ai_provider_id`, `threads.model_id`) work the same way as the global selection.

## The sign-in flow

Taico is a public OAuth client of OpenAI here. This is separate from Taico's own authorization server (`authorization-server/`), which issues tokens to Taico's clients; none of that code is involved.

1. `POST /ai-providers/:id/connection/authorize` creates a state, a nonce and a PKCE verifier, stores them (state hashed, verifier encrypted) in `ai_provider_authorization_attempts`, opens a listener on `127.0.0.1`, and returns OpenAI's authorization address.
2. The first sign-in uses OpenAI's shared client `dynamic_agent_client`; the redirect brings back a client id issued for this installation (`oaiapp_…`), which is stored and used from then on.
3. OpenAI redirects the browser to `http://127.0.0.1:<port>/auth/callback`. The listener does not finish anything. It forwards the browser to `/settings/models/chatgpt-callback` in the Taico UI with the same query.
4. The UI posts the query to `POST /ai-providers/:id/connection/callback` as the signed-in user. Only the Taico user who started the sign-in can finish it, once, within 10 minutes.
5. The backend exchanges the code, verifies the ID token (signature, issuer, audience, expiry, nonce), and stores the connection. Without the `chatgpt.tokens.use.direct` scope the account is recorded but no plan requests are made.

**When Taico is not on your own computer** (Docker, a home server), your browser cannot reach the backend's `127.0.0.1` and shows an error page after you approve. Copy the address from the address bar and paste it under "Finish signing in" in settings. It goes to the same endpoint with the same checks. Alternatively set `CHATGPT_SUBSCRIPTION_CALLBACK_PORT` and forward that port to the backend.

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
    ├── chatgpt-loopback-listener.service.ts    # 127.0.0.1 redirect → Taico UI
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

The end-to-end spec runs the whole flow against `FakeOpenAi`, which checks PKCE, the exact redirect URI and refresh-token rotation the way OpenAI does. It covers the sign-in and its failure cases, token storage, per-person isolation, model listing, job scope, a full thread turn with streaming and a tool call, refresh races, usage limits, compaction, disconnect and provider deletion. It is part of `npm run test:e2e`, which CI runs.

## Manual check with a real account

1. In your stack's env file set:
   ```bash
   SECRETS_ENABLED=true
   SECRETS_ENCRYPTION_KEY=<output of: openssl rand -hex 32>
   CHATGPT_SUBSCRIPTION_ENABLED=true
   ```
   and remove `ALLOW_PLAINTEXT_SECRETS_INSECURE`. Changing the secrets mode makes secrets stored earlier in plaintext unreadable, so use a fresh database or re-enter API keys.
2. `npm run dev`, open the UI in a browser on the same machine.
3. Settings → AI models → Add provider → **ChatGPT plan** → **Continue with ChatGPT**, and approve.
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
