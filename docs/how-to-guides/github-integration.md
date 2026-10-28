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
