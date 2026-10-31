# Self-ship

Add the `self-ship` tag to a task to have it merged and closed without a person doing it. Once the code review passes, the `@shipper` agent takes the task from there.

## How a task ships

1. The task is in review and `@code-reviewer` approves it.
2. The reviewer sees the `self-ship` tag and assigns the task to `@shipper` instead of back to the original assignee.
3. The shipper checks CI on the PR and merges it.
4. It watches the build on `main` started by the merge. It waits up to 2 minutes for one to show up, and carries on without it if none does.
5. When that passes, it marks the task as done.

The shipper reacts to tasks assigned to it that are in review and have the `self-ship` tag. It uses a merge commit and works on one task at a time.

## When it can't ship

If CI is red, the PR can't be merged or the main build fails, the shipper comments on the task with the error, assigns it back to the original assignee and puts it in `NOT_STARTED`, which triggers that agent again. If the main build failed, the PR is already merged, and the comment says so.

The shipper doesn't try to fix anything itself.

## Stopping a merge

Say so in the task description or a comment, for example "don't merge this until Friday". That overrides the tag. The shipper asks about it with an input request and waits. It only continues once the question is answered. If the answer is a clear go-ahead, it ships. Otherwise it assigns the task to whoever answered and leaves it in review. Assign it back to `@shipper` with a comment when it's ready to ship.

## Setup

`@shipper` is created on startup like the other built-in agents. It runs on OpenCode with `gpt-6.1-terra`, and needs a worker with OpenCode, OpenAI access and a GitHub token that can merge. You can change the model or the prompt on the agent page.

Existing code reviewers get the routing step on startup if their prompt was never edited. If you edited yours, add the step yourself.
