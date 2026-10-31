# Agent follow-up prompts

A follow-up prompt is an optional second message for an agent. When the agent finishes its turn, the worker sends the prompt on the same session and keeps the run open. The run ends when the agent is done with it. Use it for checks such as "did you put the task in review? If not, do it now."

Set it on the agent page, under the system prompt, or in the new agent wizard for custom agents. It is the `followUpPrompt` field in the agents API.

## When it runs

The worker sends the follow-up once per run, after the first turn. It doesn't send it when:

- the prompt is empty, null or only whitespace
- the run answers an input request, because those runs are told to answer and stop
- the first turn failed or the run was interrupted

The follow-up appears as **Final checks** in a run's Execution progress, between Run agent and Finish execution. Runs without a follow-up don't show the step.

Status changes and reassignments made during the first turn take effect straight away, but the next agent can only claim the task once this run ends. Keep follow-ups short.

## How each harness sends it

| Harness | How the follow-up is sent |
| --- | --- |
| Claude Code | A new query that resumes the session |
| Codex, OpenCode | A second prompt on the session after `session.idle` for that session. Subagent sessions are ignored |
| GitHub Copilot | A second `send` on the session after `session.idle`. Subagent events are ignored |
| ADK | A second run on the same session |

If a turn fails, the run fails with the provider's error, and the step that was running shows as failed: Run agent for the first turn, Final checks for the follow-up. On Codex and OpenCode a `session.error` only counts if the session goes idle without getting busy again, because OpenCode reports a context overflow as an error and then compacts and carries on. Errors with no session, which come from loading plugins and skills, are ignored.

Thread agents don't use follow-up prompts. Only task runs do.

## Built-in agents and templates

The developer, code reviewer and helper templates and built-in agents come with a follow-up built from the checklist in their system prompt. The text lives in `apps/backend/src/app-init/prompts/prompts.ts`. To add one to another template, set `followUpPrompt` in `agent-template.catalog.ts`. For a built-in agent, set it on the agent seed. New agents pick it up from there; an agent that already exists needs its own data migration.

Agents that already existed when follow-up prompts shipped got theirs once, from the `BackfillAgentFollowUpPrompts` migration:

- Built-in agents were matched by slug, even if their system prompt was edited.
- Agents created from a template were matched by their exact system prompt, including earlier seeded versions.

The migration doesn't run again, so clearing a follow-up sticks whether it is stored as `null` or an empty string. Nothing overwrites an edited follow-up, and changing a seeded follow-up only affects agents created afterwards.

Databases in `TYPEORM_SCHEMA_MODE=sync` don't run migrations, so their existing agents get no follow-up until you set one.
