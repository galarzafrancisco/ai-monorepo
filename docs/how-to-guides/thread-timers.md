# Thread timers: reminders and schedules

The threads agent only acts when something wakes it up. Three things can wake it without a person typing:

| What | Tool to set | Tool to cancel | Stored in |
|---|---|---|---|
| A watched task goes to review or done | `subscribe_to_task` | `unsubscribe_from_task` | `thread_task_subscriptions` |
| A one-off reminder | `remind` | `cancel_reminder` | `thread_timers` (`kind = reminder`) |
| A recurring schedule | `schedule` | `cancel_schedule` | `thread_timers` (`kind = schedule`) |

`list_reminders_schedules_and_watchers` lists all three with their IDs. The thread sidebar shows them at the top, in sections called Reminders, Schedules and Watching for completion. Each line has a trash icon that cancels it (`DELETE /threads/:id/timers/:timerId`, `DELETE /threads/:id/task-subscriptions/:taskId`). Cancelling is idempotent everywhere.

## Inputs

- Durations (`schedule.period`, `remind.in`) are a positive whole number followed by one unit, `s`, `m` or `h`. Compound values like `1h30m` are rejected. The longest allowed is 366 days.
- `maxIterations` is required and must be from 1 to 10.
- `remind.at` must name exactly one instant. Give either an ISO datetime with an offset (`Z`, `+11:00`), or a local datetime plus an IANA `timezone`. The tool rejects a local time with no timezone, an offset that disagrees with the timezone, a time that is in the past, and local times that a DST change skips or repeats. See `apps/backend/src/threads/timers/timer-input.ts`.
- The backend never guesses the user's timezone. Tool output and the API use UTC ISO timestamps, and the UI formats them in the browser's timezone.
- To work out a local `at` (for example "tomorrow at 5pm"), the agent calls `get_time`. See [Current time and the user's timezone](#current-time-and-the-users-timezone).

## Current time and the user's timezone

`get_time` takes no input. Its description says to call it when the user asks for the time or date, or before working out a local time for a reminder. The system prompt does not mention it.

A turn also ends when the model makes the same tool calls, with the same input, three steps in a row. The agent then posts a message naming the tool, so the user is not left with a silent turn. See `apps/backend/src/threads/agent/repeated-tool-call.ts`. Without this check, a model that picked the wrong tool repeated it until the 25-step limit.

On the ChatGPT plan, `gpt-6-luna` asked "what time is it?" used to call `tasks__get_all_tags` instead, and repeat it; asked afterwards, it said it had meant to check the time. The model sent that name itself (the SDK passes tool names through unchanged), with no reasoning before the call. The cause was that every tool went in one `taico` namespace: Taico's own tools (`get_time`, `remind`, `list_reminders_schedules_and_watchers`, …) sat after 41 `tasks__*` and `context__*` MCP tools, and the model passed over all of them, not just `get_time`. Replaying the captured request, it called `get_time` 0 times in 20. Putting Taico's own tools in their own namespace, with nothing else changed, made it 8 in 8, for `remind` and `list_reminders_schedules_and_watchers` too; the namespace's description made no difference. Tool position, names, `$schema` and a system prompt line naming `get_time` each only moved the odds; with the namespaces in place, that line made no difference and was removed. So OpenAI models, on the ChatGPT plan and with an API key, now get one namespace per MCP server and one for Taico's own tools (`toolNamespace` in `apps/backend/src/ai-providers/openai-tool-namespaces.ts`). Only OpenAI's Responses API has tool namespaces; the other providers get a flat list of tools, and were not tested for this.

It returns:

| Field | Meaning |
|---|---|
| `now` | Current time, ISO 8601 with offset. In the user's timezone when known (`2026-10-16T16:13:14+11:00`), otherwise UTC (`2026-10-16T05:13:14Z`) |
| `userTimezone` | IANA timezone of the latest user message (`Australia/Sydney`), or `null` when unknown |
| `lastUserMessageAt` | When the latest user message was sent, same format as `now`; `null` when no person has written in the thread |

Where the data comes from:

- The UI sends the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) as `timezone` with every `POST /threads/:id/messages`. The field is optional; a value that is not an IANA name the backend knows (including raw offsets like `+10:00`) is rejected with 400.
- It is stored per message in `thread_messages.timezone`, so a person who travels is placed correctly from their next message. Agent messages and messages from clients that send no timezone store `null`.
- "Latest user message" is the newest message in the thread written by a human actor. Its timezone is used even when it is `null`; older messages are not searched for one.
- Each local time uses the offset in force at that instant, so a message sent before a daylight saving change and the current time after it get different offsets.

The timezone is kept out of the conversation the model sees: the copy of the message in `thread_agent_messages` holds only the text. The model reads it only when it calls the tool.

Code: `apps/backend/src/threads/time/`.

## Firing

1. Every backend process runs `ThreadTimerSweeperService` every 5 seconds, so a timer can fire up to about 5 seconds late.
2. The sweep claims due timers with one `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)`. The claim increments `fired_count`, moves `next_fire_at` to the next occurrence, and queues one row in `thread_timer_firings` (unique per timer and iteration). Only the process whose UPDATE returned the row requests an agent turn.
3. The turn's `ThreadAgentLogService.ingestTimerFirings` locks the thread and the queued firings. It appends one `<context source="schedule|reminder" …>` injection per queued firing, oldest first (the thread key is added when the injection is sent to the model). It then deletes the delivered firings, and deletes the timer once its last firing is delivered. Doing all of this in one transaction means each firing is delivered once, however many backends run.

Firings are queued, not overwritten. If a schedule fires several times while the agent is busy with a long turn, the next turn delivers every one of those firings, in order. The one-catch-up rule below only applies to downtime.

A schedule's first firing comes one period after it is created. The last firing tells the agent that it is final.

### After downtime

A timer that missed several occurrences fires **once**. The missed occurrences are skipped and don't count as iterations. The next firing stays on the original cadence: it is the first occurrence after now.
