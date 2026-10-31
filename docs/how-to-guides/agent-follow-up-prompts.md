# Agent follow-up prompts

A follow-up prompt is an optional second message for an agent. When the agent finishes its turn, the worker sends the prompt on the same session and keeps the run open. The run ends when the agent is done with it. Use it for checks such as "did you put the task in review? If not, do it now."

Set it on the agent page, under the system prompt, or in the new agent wizard for custom agents. It is the `followUpPrompt` field in the agents API.

## When it runs

The worker sends the follow-up once per run, after the first turn. It doesn't send it when:

- the prompt is empty, null or only whitespace
- the run answers an input request, because those runs are told to answer and stop
- the first turn failed or the run was interrupted

Status changes and reassignments made during the first turn take effect straight away, but the next agent can only claim the task once this run ends. Keep follow-ups short.

## How each harness sends it

| Harness | How the follow-up is sent |
| --- | --- |
| Claude Code | A new query that resumes the session |
| Codex, OpenCode | A second prompt on the session after `session.idle` |
| GitHub Copilot | A second `send` on the session after `session.idle` |
| ADK | A second run on the same session |

Thread agents don't use follow-up prompts. Only task runs do.

## Built-in agents and templates

The developer, code reviewer and helper templates and built-in agents come with a follow-up built from the checklist in their system prompt. The text lives in `apps/backend/src/app-init/prompts/prompts.ts`. To add one to another template, set `followUpPrompt` in `agent-template.catalog.ts`. For a built-in agent, set it on the agent seed and add the seed to `AGENTS_WITH_FOLLOW_UP` in `app-init.runner.ts`.

On startup, `AppInitRunner.ensureFollowUpPrompts` fills in agents whose follow-up is `null`:

- Built-in agents are matched by slug, even if their system prompt was edited.
- Agents created from a template are matched by their exact system prompt, including earlier seeded versions.

Clearing a follow-up in the UI stores an empty string, not `null`, so it stays cleared across restarts. An edited follow-up is never overwritten, and changing a seeded follow-up doesn't update agents that already have one.
