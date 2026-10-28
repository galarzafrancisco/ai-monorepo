# GitHub integration

Taico can connect to GitHub. A connection does three things:

- shows the status of pull requests linked anywhere in Taico (open, draft, merged, closed, CI, approvals, size);
- lets threads watch pull requests and wake up when something happens;
- if a project allows it, gives workers a token to clone, push and open pull requests.

Taico stays agnostic: agents keep adding PR links to tasks, comments and threads as usual. Taico notices the links on its own.

## Connections

Settings > Integrations lists the GitHub connections. There are two kinds:

| Kind | What you paste | Acts as | Token handed to workers |
|---|---|---|---|
| Personal access token | The token | The person who made it | The token itself, reaching everything it can |
| GitHub App | App id, installation id and the app's PEM private key | The app's installation | A one-hour installation token limited to the project's repository |

A personal access token is the quickest to set up and needs no admin rights. A GitHub App needs someone who can create and install apps on the account or organization, but gives short-lived, narrowly scoped tokens.

Suggested permissions (fine-grained token or app): Pull requests read, Commit statuses read, Checks read, Metadata read. Add Contents read and write, and Pull requests write, if workers should clone, push and open pull requests.

Before a connection is saved, Taico checks the credential with GitHub (`GET /user` for a token, `GET /app/installations/:id` with an app JWT) and records the login it acts as. A credential GitHub rejects is never saved. "Check again" re-runs the check and shows why it failed, if it did.

The credential is stored with the secrets feature (encrypted, never returned by the API). Deleting a connection deletes its secret. Connections need the `integration:read`, `integration:write` and `integration:delete` scopes.

Code: `apps/backend/src/integrations/`.

## Which connection a repository uses

1. The connection the repository's project names (project page > GitHub > Connection).
2. Otherwise the connection whose **repository owners** include the repository's owner (matched without case). A new connection's owners default to the account it acts as.
3. Otherwise the only connection, if there is exactly one.
4. Otherwise none: Taico reads public repositories anonymously, within GitHub's limit of 60 requests an hour.

`GET /integrations/github/connections/resolve?repoUrl=…&connectionId=…` answers which one applies and why. Deleting a connection a project names puts the project back on automatic.

## Who sees what

Access is Taico-wide. Anyone who can see a task, comment or thread with a pull request link sees that pull request's status, title and size, even without access to the repository on GitHub. The project page says so next to the connection picker.

## Workers

Each project has a "Workers use this connection" switch, off by default. When off, workers use whatever git and `gh` credentials the machine they run on already has.

## Pull requests

Taico keeps one copy of each linked pull request in `pull_requests`, however many places link to it, keyed by `owner/repo#number` in lower case.

### Noticing links

`PullRequestReferencesListener` reads pull request links (`https://github.com/<owner>/<repo>/pull/<n>`, including `/files`, `/commits` and `#comment` anchors) from:

| Where | Recorded as | Belongs to |
|---|---|---|
| Task links (artefacts) | `task_artefact` | the task |
| Task name and description | `task_description` | the task |
| Task comments | `task_comment` | the task |
| Thread messages | `thread_message` | the thread |

Each source's links replace the ones it had, so editing a description drops pull requests it no longer mentions. The `PullRequests` migration records links that already existed, without reading them from GitHub until someone looks.

### Reading from GitHub

A look at a pull request is four conditional requests: the pull request, its reviews, and the check runs and commit statuses of its head commit. GitHub answers 304 for anything unchanged, which costs nothing against the rate limit, and Taico reuses what it stored.

- **CI** (`checksStatus`): check runs and commit statuses together. Any failure (failed, cancelled, timed out, action required) wins: `failure`. Otherwise anything queued or running: `pending`. Otherwise any success: `success`. Nothing reported: `none`. Skipped and neutral runs do not count.
- **Reviews** (`reviewDecision`, `approvals`): the latest approving or changes-requesting review of each reviewer; a dismissed review clears that reviewer. Any "changes requested" wins over approvals. Required reviewers and branch protection are not considered.
- **Comments** (`commentCount`): conversation comments plus review comments.

The connection used is the one of the first project whose repository it is, if that project names one, then the usual resolution order. Without a connection the request is anonymous.

### When Taico looks again

`PullRequestPollerService` runs on every backend process every 5 seconds and claims up to 20 due pull requests (`next_fetch_at <= now()`, `FOR UPDATE SKIP LOCKED`, a 2-minute lease). After each look, `nextFetchDelayMs` (`pull-request-schedule.ts`) picks the next one from demand:

| Demand | Without webhooks | With webhooks |
|---|---|---|
| A thread is watching it (`watched_until`) | 30 s | 5 min |
| Someone viewed it in the last 10 minutes | 1 min | 10 min |
| Linked from a task that is not done, or a thread in the last day | 5 min | 30 min |
| Anything else | not polled | not polled |
| Merged or closed | never again | never again |

"With webhooks" means the connection received a valid delivery in the last hour. A pull request that is not polled is read again when someone views it and the copy is older than 2 minutes, when a webhook names it, or when it is watched. Failures back off from 30 seconds to an hour; a pull request GitHub says does not exist is not retried until something asks for it.

### Webhooks (optional)

Settings > Integrations > Webhook shows a payload URL (`/api/v1/integrations/github/webhooks/<connection id>`, built from `ISSUER_URL`) and a secret, created the first time it is asked for. Add them to the repository or organization webhooks (token connections) or to the GitHub App, with these events: pull requests, pull request reviews and review comments, issue comments, check runs, check suites and statuses.

Each delivery must carry a valid `X-Hub-Signature-256`; anything else gets 401. A delivery only marks the pull requests it names (by number, or by head commit for CI events) for a fresh look within 5 seconds: Taico then reads them through the API, so a payload can never write state directly. GitHub must be able to reach Taico for webhooks to work.

### API and events

- `POST /pull-requests/lookup` `{ refs: [...] }` (links or `owner/repo#n`, at most 50): the stored state in the order asked. Pull requests never read before are read first; stale ones are refreshed in the background. Marks them as viewed.
- `GET /pull-requests/:id`, `POST /pull-requests/:id/refresh`.
- Scopes: `pull_request:read`, `pull_request:write` (refresh).
- `PullRequestUpdatedEvent` (internal) fires when the stored copy changes, with the `changes` since the last look: `merged`, `closed`, `reopened`, `ready_for_review`, `converted_to_draft`, `new_commits`, `checks_started`, `checks_passed`, `checks_failed`, `approved`, `changes_requested`, `new_comments`. The first look has none.
- Socket.io namespace `/pull-requests`: `pull_requests.subscribe` joins one room; `pull_request.updated` carries the new state and the changes.

Code: `apps/backend/src/pull-requests/`.

## In the UI

Pull request links are drawn with their live state wherever they appear (`apps/ui/src/features/pull-requests/`):

| Where | How |
|---|---|
| Board cards and task rows | One chip per pull request link of the task (`#1142`), colored by state, with CI and approval. Other links still count as `🔗 n`. |
| Task header | The full name (`owner/repo#1142`), CI, approval, and a link out. |
| Task descriptions and comments | Links become clickable; pull request links are drawn inline, colored by state. |
| Thread messages | The same, through the Markdown renderer. |

Colors follow GitHub: open green (`--pr-open`), draft gray (`--pr-draft`), merged purple (`--pr-merged`), closed red (`--pr-closed`). CI shows as a green spinner while checks run, a red cross when any failed, and a green dot when all passed; a green tick means approved. CI and approvals are only shown on open pull requests.

Hovering a chip (or tapping it on touch screens) opens a card with the title, branches, author, lines added and removed, files, comments, which checks failed, and the review state. The card is a `Popover` in a portal, so board columns never clip it.

`pullRequestStore` keeps one copy of every pull request on screen: requests made in the same render share one `POST /pull-requests/lookup`, the `/pull-requests` socket keeps them live, and pull requests still on screen are looked up again every 4 minutes (which keeps them in the backend's "viewed" polling tier) and after a reconnect.
