# Access requests (expressions of interest)

Taico sign-up is invite-only. People who aren't invited can say they're interested from the public `/join` page, and admins review those requests in **Settings > Access requests**. A request never creates an account or allowlists anyone. To let someone in, an admin invites them from **Settings > Users**.

## The journey

1. **Login page.** A "What is Taico?" link goes to the public `/marketing` page.
2. **Create account.** The UI asks the backend whether the email can be set up (`POST /auth/account-setup-status`, unchanged). If it can, normal onboarding continues. If it can't, the UI shows a generic message ("If you already have an account, sign in instead...") and a **Request access** button. The button opens `/join` with the email prefilled. The response doesn't say *why* setup isn't possible (not invited, already set up or deactivated), so no new information about accounts is exposed.
3. **`/join`.** The form posts to `POST /api/v1/access-requests`. The UI only says "Request received" after the backend replies `201`.
4. **Review.** Admins list, search, filter (new/reviewed), mark as reviewed or new, and delete requests.

The public pages (`/join`, `/marketing`) always use the official dark theme. Visitors haven't used Taico yet, so any theme saved in that browser is ignored there (and left untouched): `PublicLayout` sets `data-theme="dark"` while mounted and puts the previous value back when the visitor moves into the app.

The email travels from step 2 to step 3 in React Router navigation state, not in the URL, so it doesn't end up in server logs, referrers or shareable links. `/join` reads it once and then replaces the history entry to clear it.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/access-requests` | Public | Write-only. Body: `email` (≤254), optional `building` (≤280), optional `heardFrom` (enum, see below), optional `heardFromOther` (≤120), honeypot `website`. Always `201 { received: true }` on success. |
| `GET` | `/api/v1/admin/access-requests` | `user:admin` scope | `status`, `search` (≤100, email, answer or "other" source text, case-insensitive), `limit` (≤200), `offset`. Most recently submitted first. |
| `PATCH` | `/api/v1/admin/access-requests/:id` | `user:admin` scope | `{ status: 'new' \| 'reviewed' }` |
| `DELETE` | `/api/v1/admin/access-requests/:id` | `user:admin` scope | Hard delete |

Admin routes use `AccessTokenGuard` + `ScopesGuard` + `@RequireScopes(UserScopes.ADMIN.id)`, the same pattern as client registration. Anonymous calls get `401`, signed-in non-admins `403`. The admin scope is set when the user signs in, so a role change applies at their next sign-in.

## Where did you hear about Taico?

`/join` has an optional dropdown. The stored values (`AccessRequestHeardFrom`) are stable and the labels live only in the UI (`HEARD_FROM_OPTIONS` in `apps/ui/src/features/marketing/accessRequest.ts`):

| Value | Label |
| --- | --- |
| `x` | X |
| `linkedin` | LinkedIn |
| `word_of_mouth` | Word of mouth |
| `conference_tshirt` | Saw a T-shirt at a conference |
| `other` | Other (reveals an optional free-text field, ≤120) |

- Columns `heard_from` and `heard_from_other` are nullable, so requests from before the question existed stay valid and show no source in the admin view.
- `heard_from_other` is only kept when `heard_from = 'other'`. The UI clears the text when another option is picked, the service drops it otherwise, and a DB check constraint (`CHK_access_requests_heard_from_other`) enforces it.
- An unknown `heardFrom` value is rejected with `400`. There's no DB check on the value itself, so adding a source only needs the enum, the UI option and a regenerated client. Never rename or reuse a value: existing rows keep it. The admin view falls back to showing the raw value if it doesn't know the label.
- A repeat submission that names a source replaces the stored source and text together. One without a source keeps the stored one.
- Admins see the source under each request in **Settings > Access requests**.

## Abuse and duplicates

- **Validation.** All fields are bounded and trimmed on client and server. Unknown fields are rejected by the global validation pipe.
- **Duplicates.** Emails are unique case-insensitively. A repeat submission updates the row (`submission_count + 1`, `last_submitted_at = now()`, new answer if one is given) and gets the exact same response, so the form can't be used to check whether an email was submitted before. Status is left as it was. Because the list is ordered by `last_submitted_at`, the repeat moves to the top.
- **Honeypot.** If the hidden `website` field is filled, the backend returns the normal success response and stores nothing.
- **Rate limits.** See [Rate limiting](#rate-limiting).
- No CAPTCHA, IP address or IP fingerprint is collected, and no deployment secrets or environment variables are needed.

## Rate limiting

`POST /api/v1/access-requests` has two limits:

| Where | Limit | Response | Scope |
| --- | --- | --- | --- |
| Gateway (`install/manifests/base/rate-limit.yaml`) | 10 per minute, burst 5 | `429`, plain-text body `rate limit exceeded`, `x-ratelimit-limit` / `-remaining` / `-reset` headers (seconds). No `Retry-After`. | All clients share one bucket on the gateway proxy. It covers all Taico replicas and survives app restarts. |
| Backend (`access-requests.service.ts`) | 300 accepted per hour | `429` `ACCESS_REQUESTS_BUSY` | Per backend process, resets on restart. Kept as a backstop. |

The gateway limit is an agentgateway `local` rate limit attached only to the `access-requests-submit` rule of the `taico` HTTPRoute. A rule-level policy takes precedence over the gateway-wide `rateLimit` in the `gateways` namespace, so the general limit still applies to every other path.

**These limits aren't per client.** One flood can briefly block `/join` for everyone. agentgateway can only key limits by client IP with `global` rate limiting, which needs an external rate-limit service (such as envoy `ratelimit` with Redis). Taico doesn't run one, to avoid adding infrastructure. If abuse shows up in practice, that's the next step: point a `global` descriptor at `source.address`, after the `x-forwarded-for` normalisation already in the gateway policy.

`/api/v1/auth/login` and `/api/v1/auth/account-setup-status` have no extra gateway limit. A shared bucket there would let one client lock everyone out of sign-in. Those paths rely on the gateway-wide limit.

The gateway doesn't log request bodies. Its access log adds user agent and forwarded IP attributes, which are configured in the `gateways` repo, not here. Taico itself stores no IPs.

## Privacy and retention

- **Stored data.** Email, the optional answer, the optional "where did you hear about Taico" source and its free text, status, submission count, timestamps, and the ID of the admin who reviewed the request.
- **Logging.** Submitted values aren't logged.
- **Rendering.** The admin UI renders all submitted text as plain React text.
- **Retention.** There's no automatic purge. Admins delete requests they no longer need, including on request from the person who submitted one. If volume grows, add a scheduled purge of reviewed rows older than N days.
- No emails are sent.
