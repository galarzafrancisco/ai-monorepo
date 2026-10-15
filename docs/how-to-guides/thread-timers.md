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
- `maxIterations` is required and must be from 1 to 1000.
- `remind.at` must name exactly one instant. Give either an ISO datetime with an offset (`Z`, `+11:00`), or a local datetime plus an IANA `timezone`. The tool rejects a local time with no timezone, an offset that disagrees with the timezone, a time that is in the past, and local times that a DST change skips or repeats. See `apps/backend/src/threads/timers/timer-input.ts`.
- The backend never guesses the user's timezone. Tool output and the API use UTC ISO timestamps, and the UI formats them in the browser's timezone.

## Firing

1. Every backend process runs `ThreadTimerSweeperService` every 5 seconds, so a timer can fire up to about 5 seconds late.
2. The sweep claims due timers with one `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)`. The claim increments `fired_count`, sets `pending_iteration`/`triggered_at`, and moves `next_fire_at` to the next occurrence. Only the process whose UPDATE returned the row requests an agent turn.
3. The turn's `ThreadAgentLogService.ingestTimerFirings` locks the thread and the triggered rows. It appends one `<context source="schedule|reminder" …>` injection per firing (the thread key is added when the injection is sent to the model), then clears the trigger, or deletes the row if that was the last firing. Doing all of this in one transaction means each firing is delivered once, however many backends run.

A schedule's first firing comes one period after it is created. The last firing tells the agent that it is final.

### After downtime

A timer that missed several occurrences fires **once**. The missed occurrences are skipped and don't count as iterations. The next firing stays on the original cadence: it is the first occurrence after now. If a timer fires again before the agent has been told about the previous firing, the agent only hears about the latest one.
