# Access requests (expressions of interest)

Taico sign-up is invite-only. People who aren't invited can say they're interested from the public `/join` page, and admins review those requests in **Settings > Access requests**. A request never creates an account or allowlists anyone. To let someone in, an admin invites them from **Settings > Users**.

## The journey

1. **Login page.** A "What is Taico?" link goes to the public `/marketing` page.
2. **Create account.** The UI asks the backend whether the email can be set up (`POST /auth/account-setup-status`, unchanged). If it can, normal onboarding continues. If it can't, the UI shows a generic message ("If you already have an account, sign in instead...") and a **Request access** button. The button opens `/join` with the email prefilled. The response doesn't say *why* setup isn't possible (not invited, already set up or deactivated), so no new information about accounts is exposed.
3. **`/join`.** The form posts to `POST /api/v1/access-requests`. The UI only says "Request received" after the backend replies `201`.
4. **Review.** Admins list, search, filter (new/reviewed), mark as reviewed or new, and delete requests.

The email travels from step 2 to step 3 in React Router navigation state, not in the URL, so it doesn't end up in server logs, referrers or shareable links. `/join` reads it once and then replaces the history entry to clear it.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/access-requests` | Public | Write-only. Body: `email` (≤254), optional `building` (≤280), honeypot `website`. Always `201 { received: true }` on success. |
| `GET` | `/api/v1/admin/access-requests` | `user:admin` scope | `status`, `search` (≤100, email or answer, case-insensitive), `limit` (≤200), `offset`. Most recently submitted first. |
| `PATCH` | `/api/v1/admin/access-requests/:id` | `user:admin` scope | `{ status: 'new' \| 'reviewed' }` |
| `DELETE` | `/api/v1/admin/access-requests/:id` | `user:admin` scope | Hard delete |

Admin routes use `AccessTokenGuard` + `ScopesGuard` + `@RequireScopes(UserScopes.ADMIN.id)`, the same pattern as client registration. Anonymous calls get `401`, signed-in non-admins `403`. The admin scope is set when the user signs in, so a role change applies at their next sign-in.

## Abuse and duplicates

- **Validation.** All fields are bounded and trimmed on client and server. Unknown fields are rejected by the global validation pipe.
- **Duplicates.** Emails are unique case-insensitively. A repeat submission updates the row (`submission_count + 1`, `last_submitted_at = now()`, new answer if one is given) and gets the exact same response, so the form can't be used to check whether an email was submitted before. Status is left as it was. Because the list is ordered by `last_submitted_at`, the repeat moves to the top.
- **Honeypot.** If the hidden `website` field is filled, the backend returns the normal success response and stores nothing.
- **Ceiling.** There's a best-effort, in-process limit of 300 accepted submissions per backend process per hour (`ACCESS_REQUESTS_BUSY`, `429`). It isn't shared across replicas and resets on restart. It only bounds how fast one flood can fill the table. Per-client rate limiting belongs at the gateway and is tracked as a separate task.
- No CAPTCHA, IP address or IP fingerprint is collected, and no deployment secrets or environment variables are needed.

## Privacy and retention

- **Stored data.** Email, the optional answer, status, submission count, timestamps, and the ID of the admin who reviewed the request.
- **Logging.** Submitted values aren't logged.
- **Rendering.** The admin UI renders all submitted text as plain React text.
- **Retention.** There's no automatic purge. Admins delete requests they no longer need, including on request from the person who submitted one. If volume grows, add a scheduled purge of reviewed rows older than N days.
- No emails are sent.
