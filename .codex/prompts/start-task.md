---
description: Your goal is to pick up a task and work on it, taking it all the way from "not started" to "for review".
argument-hint: [TASK_ID=<task>] [ROLE=<role>]
---

# Input
- TASK_ID: id of the task to work on
- ROLE: who is picking up the task (dev, reviewer, pm etc). Usually dev.

Your AGENT_NAME will be `codex-{$ROLE}`. For example, `codex-dev`.

# Workflow
If the task changes files in the repo (code or docs), follow every step. If it doesn't (investigation, questions), skip the steps marked (repo) and finish with step 8.b.

### Prep
1. Get a session ID: `.codex/scripts/workflow/start_session.sh`
2. Fetch the task using MCP tool `mcp.tasks.get_task`
3. Claim it right away with the MCP tool `mcp.tasks.mark_task_in_progress` ({TASK_ID}; `branchName` is optional)
4. (repo) Prepare the local environment `.codex/scripts/workflow/start_task.sh {AGENT_NAME} {SESSION_ID} {TASK_ID} {TASK_NAME}` where TASK_NAME is a branch-safe-short-name you make up based on the task
### Work
5. Get instructions for your role from `.codex/roles/{ROLE}.md` (for example, `.codex/roles/dev.md`)
6. (repo) As soon as you have a first useful commit, open a draft PR: `.codex/scripts/workflow/open_pr_to_agents_main.sh "PR Title" "PR Body" --draft`. Attach it to the task with the MCP tool `mcp.tasks.add_artefact`, then keep pushing commits to it
7. Do the work & make frequent comments to the task
### Finish
8.a. (repo) Update the PR description (what you did, how you tested it, technical debt), mark it ready (`gh pr ready`), then call `mcp.tasks.mark_task_for_review` with {TASK_ID} {PR_LINK}. Watch CI. Do not merge: the PR waits for a reviewer.
  - (repo) If CI passed: comment that CI is green and assign the task to `code-reviewer` with `mcp.tasks.assign_task`
  - (repo) If CI failed: put the task back with `mcp.tasks.mark_task_needs_work` explaining the failure, then start work again
8.b. (no repo changes) Post your findings on the task, set it to `FOR_REVIEW` with `mcp.tasks.change_task_status`, and assign it to whoever created it with `mcp.tasks.assign_task`
9. (repo) When done, checkout `agents/main` and pull
