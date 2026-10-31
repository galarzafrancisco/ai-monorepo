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

Say so in the task description or a comment, for example "don't merge this until Friday". That overrides the tag. The shipper doesn't merge. Instead it:

1. Removes the `self-ship` tag, so it won't be triggered for this task again.
2. Comments with the reason, and how to turn auto-shipping back on.
3. Asks how to proceed with an input request, so the task shows as waiting on you.

Answering that question doesn't ship the task. To retry auto-shipping, do these in order:

1. Answer the question. Tasks with an open question aren't picked up, so adding the tag alone does nothing.
2. Add the `self-ship` tag again.

If you add the tag first, the task ships as soon as the question is answered, so keep the tag off until you've answered. The shipper treats the re-added tag as overriding the reason it already acted on, but a new reason stops it again.

## Setup

`@shipper` is created on startup like the other built-in agents. It runs on OpenCode with `gpt-6.1-terra`, and needs a worker with OpenCode, OpenAI access and a GitHub token that can merge. You can change the model or the prompt on the agent page.

Existing code reviewers get the routing step on startup if their prompt was never edited. If you edited yours, add the step yourself.
