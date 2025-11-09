# Start task
Your goal is to pick up a task and work on it, taking it all the way from "not started" to "done".

# Input
- TASK_ID: id of the task to work on
- ROLE: who is picking up the task (dev, reviewer, pm etc). Usually dev.

Your AGENT_NAME will be `codex-{ROLE}`. For example, `codex-dev`.

# Workflow

### Prep
1. Get a session ID: `.codex/scripts/workflow/start_session.sh`
2. Fetch the task using MCP tool `mcp.taskeroo.get_task`
3. Prepare the local environment `.codex/scripts/workflow/start_task.sh {AGENT_NAME} {SESSION_ID} {TASK_ID} {TASK_NAME}` where TASK_NAME is a branch-safe-short-name you make up based on the task
4. Assign the task to yourself using the MCP tool `mcp.taskeroo.mark_task_in_progress` with the {TASK_ID} {AGENT_NAME} {SESSION_ID} and {BRANCH_NAME}
### Work
5. Get instructions for your role from `.codex/roles/{ROLE}.md` (for example, `.codex/roles/dev.md`)
5. Implement & make frequent comments to the task
### Finish
6. Open PR to `agents/main` by running `.codex/scripts/workflow/open_pr_to_agents_main.sh "PR Title" "PR Body"` -- you will get a link to the PR.
7. Mark task as in review by calling the MCP tool `mcp.taskeroo.mark_task_for_review` with {TASK_ID} {AGENT_NAME}, {PR_LINK}
8. Watch CI
9. If CI passed:
  - Merge pull request
  - Update task - done & comment saying CI passed by calling the MCP tool `mcp.taskeroo.mark_task_done` with {TASK_ID} {AGENT_NAME} {COMMENTS}.
9. If CI Failed:
  - Put the task back to  in progress with a comment explaining the failure by using the MCP tool `mcp.taskeroo.mark_task_needs_work` with {TASK_ID} {AGENT_NAME} {COMMENTS}
  - Start work again
10. When done, checkout `agents/main` and pull