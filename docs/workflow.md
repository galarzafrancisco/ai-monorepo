# Agent
- Autonomous entity making changes.
- Has a name `{ai-provider}-{role}` like `claude-dev`, `claude-pm`, `gemini-reviewer`, `codex-planner` etc.

# Main branches

## `main`
- Sacred.
- Never ever push directly here.
- Only open PRs to it.
- PRs need manual approval.
- Zero automation for git stuff.
- CI must be always green.

## `agents/main`
- Integration branch for agentic workflow
- Long lived
- Never ever push directly here.
- Same CI checks as `main`.
- CI must be always green.
- Human will periodically open PRs from `agents/main` to `main`

# Sessions
- Has a session ID `{YYYY-MM-DD}-{morning|noon|afternoon|evening|night|overnight}`.
- Lasts a couple of hours.
- Autonomous.
- There can be more than 1 agent running.
- Agents pick tasks and complete them.

# Tasks
- A small unit of work.
- Is tracked in `taskeroo`.
- Status:
  - not started
  - in progress: an agent picked it up and is working on it
  - in review: PR open, waiting for checks
  - done: CI checks passed, PR merged

# Flow

## Start a session

## Start a task

### input
- the agent that is picking up the task
- the session
- the id for the task to pick up

### flow
#### prep
- Fetch the task description from `taskeroo`.
- Must start from a clean `agents/main` branch locally. No uncommited changes. Pull latest changes.
- Cut a `{agent-name}/s/{session-id}/task/{task-name}` local branch from `agents/main` and push it.
- Update the task:
  - assign to the agent name
  - add session id 
  - move to `in progress`
#### work
- Start implementing the task.
- As you go, make frequent commits & push to origin and add comments to the task. 
#### finish
- Open a PR back to `agents/main`
- Update the task:
  - add comment with what you did & link to the PR
  - move the task to `in review`
- Watch the CI build using the `gh` cli
- If the build finishes green:
  - Add comment saying CI passed
  - Move task to `done`
- If the build fails:
  - Add comment saying it failed and why
  - Move back to `in progress`
  - Start the **work** flow again