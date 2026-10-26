# Access requests (expressions of interest)

The public `/join` page posts to `POST /api/v1/access-requests`. This stores an *expression of interest*; it never creates an account or allowlists anyone. Taico sign-up stays invitation-only (admins invite from Settings → Users).

## Flow
- **Login → "What is Taico?"** links to the public `/marketing` page.
- **Create account** with an email that isn't invited shows a short message and an "Express interest" button that navigates to `/join` with the email in *router state* (history state, never the URL).
- **Admins** review requests in Settings → Access requests (`/settings/access-requests`): search, filter new/reviewed, mark reviewed, delete.

## API
- `POST /access-requests` (public, write-only): `{ email, building?, website? }` → `202 { received: true }`. Duplicates (case-insensitive email) update the one row (`submission_count`++) and return the identical response. `website` is a honeypot: if filled, nothing is stored but the response looks successful.
- `GET/PATCH/DELETE /admin/access-requests[/:id]`: access token + server-side admin check (403 for non-admins, 401 anonymous). Nothing is publicly readable.

## Abuse protection
In-memory per-process limits: 5 requests/IP/hour and 300/hour overall (429). Set `TRUST_PROXY` (e.g. `1`) when behind an ingress so the client IP is real; otherwise all visitors share one bucket. Limits reset on restart and aren't shared between replicas; add a shared limiter or a bot challenge if abused.

## Privacy / retention
Stored: email, optional ≤280-char description, timestamps, submission count, and a salted SHA-256 of the IP (not the raw IP). Raw submissions aren't logged. Admins can delete any request; consider purging old reviewed requests periodically. No outbound email is sent.
