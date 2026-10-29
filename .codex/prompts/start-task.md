---
description: Your goal is to pick up a task and work on it, taking it all the way from "not started" to "done".
argument-hint: [TASK_ID=<task>] [ROLE=<role>]
---

# Input
- TASK_ID: id of the task to work on
- ROLE: who is picking up the task (dev, reviewer, pm etc). Usually dev.

Your AGENT_NAME will be `codex-{$ROLE}`. For example, `codex-dev`.

# Workflow

### Prep
1. Get a session ID: `.codex/scripts/workflow/start_session.sh`
2. Fetch the task using MCP tool `mcp.tasks.get_task`
3. Claim it right away with the MCP tool `mcp.tasks.mark_task_in_progress` ({TASK_ID}; `branchName` is optional)
4. Only if the task changes files in the repo (code or docs): prepare the local environment `.codex/scripts/workflow/start_task.sh {AGENT_NAME} {SESSION_ID} {TASK_ID} {TASK_NAME}` where TASK_NAME is a branch-safe-short-name you make up based on the task. Otherwise skip every branch/PR step: post your findings on the task and mark it for review.
### Work
5. Get instructions for your role from `.codex/roles/{ROLE}.md` (for example, `.codex/roles/dev.md`)
6. As soon as you have a first useful commit, open a draft PR: `.codex/scripts/workflow/open_pr_to_agents_main.sh "PR Title" "PR Body" --draft`. Attach it to the task with the MCP tool `mcp.tasks.add_artefact`
7. Implement, pushing to the same PR, & make frequent comments to the task
### Finish
8. Update the PR description (what you did, how you tested it, technical debt), mark it ready (`gh pr ready`), then mark the task as in review by calling the MCP tool `mcp.tasks.mark_task_for_review` with {TASK_ID} {AGENT_NAME}, {PR_LINK}
9. Watch CI
10. If CI passed:
  - Merge pull request
  - Update task - done & comment saying CI passed by calling the MCP tool `mcp.tasks.mark_task_done` with {TASK_ID} {AGENT_NAME} {COMMENTS}.
10. If CI Failed:
  - Put the task back to  in progress with a comment explaining the failure by using the MCP tool `mcp.tasks.mark_task_needs_work` with {TASK_ID} {AGENT_NAME} {COMMENTS}
  - Start work again
11. When done, checkout `agents/main` and pull