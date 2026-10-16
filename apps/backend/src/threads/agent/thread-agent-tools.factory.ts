import { Injectable } from '@nestjs/common';
import { tool, ToolSet } from 'ai';
import { z } from 'zod/v3';
import { ThreadTaskSubscriptionsService } from '../task-subscriptions/thread-task-subscriptions.service';
import { ThreadTimersService } from '../timers/thread-timers.service';
import { ThreadTimerKind } from '../timers/thread-timer.enums';
import { ThreadTimeService } from '../time/thread-time.service';
import {
  describeDuration,
  MAX_ITERATIONS,
  parseDuration,
  parseInstant,
  parseMaxIterations,
} from '../timers/timer-input';
import {
  CANCEL_REMINDER_TOOL,
  CANCEL_SCHEDULE_TOOL,
  GET_TIME_TOOL,
  LIST_WAITS_TOOL,
  REMIND_TOOL,
  SCHEDULE_TOOL,
  STAY_SILENT_TOOL,
  SUBSCRIBE_TO_TASK_TOOL,
  UNSUBSCRIBE_FROM_TASK_TOOL,
} from './thread-agent.prompts';

const DURATION_DESCRIPTION =
  'A positive whole number followed by one unit: "s" (seconds), "m" (minutes) or "h" (hours). Examples: "30s", "5m", "2h". Not compound: write "90m", not "1h30m".';

/**
 * Tools that only make sense inside a thread, so they are bound to the thread
 * the turn runs on instead of being exposed over MCP.
 *
 * Times the tools return are ISO 8601 in UTC. The user's timezone is only
 * available through `get_time`, which reads it from their latest message.
 */
@Injectable()
export class ThreadAgentToolsFactory {
  constructor(
    private readonly subscriptions: ThreadTaskSubscriptionsService,
    private readonly timers: ThreadTimersService,
    private readonly time: ThreadTimeService,
  ) {}

  build(input: {
    threadId: string;
    agentActorId: string;
    /** Who the turn is answering. */
    forActorId: string;
  }): ToolSet {
    const { threadId, agentActorId, forActorId } = input;

    const cancelTimer = async (id: string, noun: 'schedule' | 'reminder') => {
      const cancelled = await this.timers.cancel({ threadId, timerId: id, actorId: agentActorId });
      return {
        message: cancelled
          ? `Cancelled the ${noun} ${id}.`
          : `There is no active ${noun} ${id} in this thread; it may have finished or been cancelled already. Nothing to do.`,
        id,
        cancelled,
      };
    };

    return {
      [SUBSCRIBE_TO_TASK_TOOL]: tool({
        description:
          'Get notified in this thread when a task is in review or done. Use it when the user is waiting on the result of a task or the result matters to the conversation.',
        inputSchema: z.object({
          taskId: z.string(),
          waitingFor: z
            .string()
            .describe('What the user wants from this task, in one sentence. You get it back with the notification.'),
        }),
        execute: async ({ taskId, waitingFor }) => {
          const task = await this.subscriptions.subscribe({
            threadId,
            taskId,
            forActorId,
            waitingFor,
          });
          return task
            ? `Subscribed. Task "${task.name}" is currently ${task.status}.`
            : `Task ${taskId} not found.`;
        },
      }),
      [UNSUBSCRIBE_FROM_TASK_TOOL]: tool({
        description: 'Stop being notified about a task in this thread.',
        inputSchema: z.object({ taskId: z.string() }),
        execute: async ({ taskId }) => {
          const removed = await this.subscriptions.unsubscribe({
            threadId,
            taskId,
            actorId: agentActorId,
          });
          return removed ? 'Unsubscribed.' : 'This thread was not subscribed to that task.';
        },
      }),
      [SCHEDULE_TOOL]: tool({
        description:
          'Wake yourself up in this thread every `period`, up to `maxIterations` times, to do something without being messaged (for example, to check a task for new comments). The first firing is one period from now. Each firing gives you back `reason`.',
        inputSchema: z.object({
          period: z.string().describe(`Time between firings. ${DURATION_DESCRIPTION}`),
          maxIterations: z
            .number()
            .int()
            .describe(`How many times to fire, at most. A positive whole number up to ${MAX_ITERATIONS}.`),
          reason: z.string().describe('What to do when it fires, in one sentence.'),
        }),
        execute: async ({ period, maxIterations, reason }) => {
          const periodSeconds = parseDuration(period);
          if (!periodSeconds.ok) {
            return { error: periodSeconds.error };
          }
          const iterations = parseMaxIterations(maxIterations);
          if (!iterations.ok) {
            return { error: iterations.error };
          }
          if (!reason.trim()) {
            return { error: 'reason must not be empty.' };
          }

          const timer = await this.timers.create({
            threadId,
            kind: ThreadTimerKind.SCHEDULE,
            reason,
            periodSeconds: periodSeconds.value,
            maxIterations: iterations.value,
            firstFireAt: new Date(Date.now() + periodSeconds.value * 1000),
            forActorId,
          });

          const times = timer.maxIterations === 1 ? 'once' : `up to ${timer.maxIterations} times`;
          return {
            message: `I'll remind you every ${describeDuration(periodSeconds.value)}, ${times}. The first reminder is at ${timer.nextFireAt.toISOString()}. You can cancel this schedule using ID ${timer.id}.`,
            id: timer.id,
            nextFireAt: timer.nextFireAt.toISOString(),
            periodSeconds: periodSeconds.value,
            maxIterations: timer.maxIterations,
          };
        },
      }),
      [CANCEL_SCHEDULE_TOOL]: tool({
        description: `Cancel a schedule set with ${SCHEDULE_TOOL}, by its ID. Cancelling one that already finished is harmless.`,
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => cancelTimer(id, 'schedule'),
      }),
      [REMIND_TOOL]: tool({
        description:
          'Wake yourself up in this thread once, later, to do something without being messaged (for example, to try a deployment again). Give either `in` (a delay) or `at` (a moment). You get `reason` back when it fires.',
        inputSchema: z.object({
          in: z.string().optional().describe(`Delay from now. ${DURATION_DESCRIPTION}`),
          at: z
            .string()
            .optional()
            .describe(
              'Moment to fire, ISO 8601. Either with an offset ("2026-10-15T12:00:00Z", "2026-10-15T12:00:00+11:00"), or a local time ("2026-10-15T12:00:00") together with `timezone`.',
            ),
          timezone: z
            .string()
            .optional()
            .describe('IANA timezone of a local `at`, such as "Australia/Sydney". Only with `at`.'),
          reason: z.string().describe('What to do when it fires, in one sentence.'),
        }),
        execute: async (args) => {
          const { at, timezone, reason } = args;
          const delay = args.in;
          if ((delay === undefined) === (at === undefined)) {
            return { error: 'Give exactly one of `in` or `at`.' };
          }
          if (timezone !== undefined && at === undefined) {
            return { error: '`timezone` only applies to `at`. A delay given with `in` needs no timezone.' };
          }
          if (!reason.trim()) {
            return { error: 'reason must not be empty.' };
          }

          const now = new Date();
          let fireAt: Date;
          if (delay !== undefined) {
            const seconds = parseDuration(delay);
            if (!seconds.ok) {
              return { error: seconds.error };
            }
            fireAt = new Date(now.getTime() + seconds.value * 1000);
          } else {
            const instant = parseInstant(at!, timezone);
            if (!instant.ok) {
              return { error: instant.error };
            }
            if (instant.value.getTime() <= now.getTime()) {
              return {
                error: `${instant.value.toISOString()} is in the past (it is now ${now.toISOString()}). Pick a later time.`,
              };
            }
            fireAt = instant.value;
          }

          const timer = await this.timers.create({
            threadId,
            kind: ThreadTimerKind.REMINDER,
            reason,
            periodSeconds: null,
            maxIterations: 1,
            firstFireAt: fireAt,
            forActorId,
          });

          return {
            message: `It's now ${now.toISOString()}. I'll remind you at ${timer.nextFireAt.toISOString()}, in ${describeDelay(timer.nextFireAt.getTime() - now.getTime())}. You can cancel this reminder using ID ${timer.id}.`,
            id: timer.id,
            now: now.toISOString(),
            nextFireAt: timer.nextFireAt.toISOString(),
          };
        },
      }),
      [CANCEL_REMINDER_TOOL]: tool({
        description: `Cancel a reminder set with ${REMIND_TOOL}, by its ID. Cancelling one that already fired is harmless.`,
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => cancelTimer(id, 'reminder'),
      }),
      [LIST_WAITS_TOOL]: tool({
        description:
          'List everything that will wake you up in this thread: reminders, recurring schedules, and tasks you are watching for review or completion. Use the IDs to cancel.',
        inputSchema: z.object({}),
        execute: async () => {
          const [timers, watched] = await Promise.all([
            this.timers.listActive(threadId),
            this.subscriptions.listForThread(threadId),
          ]);
          return {
            now: new Date().toISOString(),
            reminders: timers
              .filter((timer) => timer.kind === ThreadTimerKind.REMINDER)
              .map((timer) => ({
                id: timer.id,
                reason: timer.reason,
                nextFireAt: timer.nextFireAt.toISOString(),
                cancelWith: CANCEL_REMINDER_TOOL,
              })),
            schedules: timers
              .filter((timer) => timer.kind === ThreadTimerKind.SCHEDULE)
              .map((timer) => ({
                id: timer.id,
                reason: timer.reason,
                periodSeconds: timer.periodSeconds,
                maxIterations: timer.maxIterations,
                firedCount: timer.firedCount,
                nextFireAt: timer.nextFireAt.toISOString(),
                cancelWith: CANCEL_SCHEDULE_TOOL,
              })),
            watchedTasks: watched.map((task) => ({
              taskId: task.taskId,
              name: task.name,
              status: task.status,
              waitingFor: task.waitingFor,
              cancelWith: UNSUBSCRIBE_FROM_TASK_TOOL,
            })),
          };
        },
      }),
      [GET_TIME_TOOL]: tool({
        description:
          "Get the current date and time and the user's timezone. Call it whenever the user asks what time or date it is, or before working out a local time for a reminder.",
        inputSchema: z.object({}),
        execute: async () => this.time.getTimeContext(threadId),
      }),
      [STAY_SILENT_TOOL]: tool({
        description:
          'End your turn without sending a message. Use it for system events, such as a task notification or a reminder, that do not warrant a response to the user. Never use it to ignore something the user said.',
        inputSchema: z.object({}),
        execute: async () => 'Turn ended without a message.',
      }),
    };
  }
}

/** "5 minutes", "2 hours 5 minutes", "3 days 4 hours": the two largest units. */
function describeDelay(ms: number): string {
  let seconds = Math.max(0, Math.round(ms / 1000));
  const units: Array<[string, number]> = [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const parts: string[] = [];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count > 0) {
      parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
      seconds -= count * size;
    }
    if (parts.length === 2) {
      break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'less than a second';
}
