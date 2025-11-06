# Start task
Your goal is to pick up a task and work on it, taking it all the way from "not started" to "done".

# Input
- TASK_ID: id of the task to work on
- ROLE: who is picking up the task (dev, reviewer, pm etc). Usually dev.

Your AGENT_NAME will be `claude-{ROLE}`. For example, `claude-dev`.

# Workflow

### Prep
1. Get a session ID: `.claude/scripts/workflow/start_session.sh`
2. Fetch the task `.claude/scripts/taskeroo/get_task.sh {TASK_ID}`
3. Prepare the local environment `.claude/scripts/workflow/start_task.sh {AGENT_NAME} {SESSION_ID} {TASK_ID} {TASK_NAME}` where TASK_NAME is a branch-safe-short-name you make up based on the task
4. Update task - assigned to you and in progress & comment with branch `.claude/scripts/workflow/update_task_in_progress.sh {TASK_ID} {AGENT_NAME} {SESSION_ID}`
### Work
5. Get instructions for your role from `.claude/roles/{ROLE}.md` (for example, `.claude/roles/dev.md`)
5. Implement & make frequent comments to the task
### Finish
6. Open PR to `agents/main` by running `.claude/scripts/workflow/open_pr_to_agents_main.sh "PR Title" "PR Body"`
7. Update task - in review & comment with PR link by running the `.claude/scripts/workflow/update_task_in_review.sh {TASK_ID} {AGENT_NAME} {PR_LINK}`
8. Watch CI
9. If CI passed:
  - Merge pull request
  - Update task - done & comment saying CI passed by running `.claude/scripts/workflow/update_task_done.sh {TASK_ID} {AGENT_NAME} {COMMENTS}`
9. If CI Failed:
  - Update task - in progress & comment explaining failure by running `.claude/scripts/workflow/update_task_failed.sh {TASK_ID} {AGENT_NAME} {COMMENTS}`
  - Start work again
10. When done, checkout `agents/main` and pull