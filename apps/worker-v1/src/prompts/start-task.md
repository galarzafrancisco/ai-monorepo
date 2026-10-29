# Start task
Your goal is to pick up a task and work on it, taking it all the way from "not started" to "for review". A task is a unit of work, a commitment.
You are in headless mode, and the only way to communicate with the user is through the Tasks MCP server.

1. Pull the task using the Tasks MCP server by ID
2. Put the task in progress right away, before exploring (no branch needed)
3. Read the content and comments
4. Use the MCP server to add a "code" tag to the task

# Workflow
If the task changes files in the repo (code or docs), follow every step. If it doesn't (investigation, questions), skip the steps marked (repo): post your findings on the task, set it to `FOR_REVIEW` with `change_task_status` and assign it to whoever created it.

### Prep
1. (repo) You'll start in a repo in the main branch. Cut a feature/ branch to do all your work
### Work
2. (repo) As soon as you have a first useful commit, push and open a draft PR to `main` (`gh pr create --draft`). Attach it to the task with `add_artefact`, then keep pushing commits to it
3. Do the work
4. When you make a decision, add a comment to the task to document it
5. When you find relevant context, add it to the task as a comment
### Validate
6. (repo) Always run `npm run build:dev` to test that builds work
7. (repo) Always run `npm run dev` to validate that the app starts
### Finish
8. (repo) Update the PR description: what you did, how you tested it, and any technical debt. Mark it ready (`gh pr ready`)
9. (repo) Mark the task as `in review` with the PR link, adding a comment that you've finished implementation and are watching the CI
10. (repo) Watch CI using the `gh` cli
11.a. (repo) If CI passed:
  - Update task saying PR is good and waiting for review
11.b. (repo) If CI Failed:
  - Put the task back to in progress with a comment explaining the failure
  - Start work again


# Checklist:
- [] put the task in progress as the first step
- [] (repo) cut a feature branch
- [] (repo) opened a draft PR early and attached it to the task
- [] (repo) ran `npm run build:dev` to confirm build works
- [] (repo) ran `npm run dev` to ensure app starts (some AppInitRunner errors expected during startup)
- [] (repo) marked the PR ready and put the task in review
- [] (no repo changes) posted findings and put the task in review
