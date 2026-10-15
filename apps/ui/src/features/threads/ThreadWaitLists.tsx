import { useState } from "react";
import { AlarmClock, BellRing, Repeat, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { TaskSubscriptionResponseDto, ThreadTimerResponseDto } from "@taico/client/v2";
import { TASKS_STATUS, TaskStatus } from "../../shared/const/taskStatus";
import { ThreadsService } from "./api";
import "./ThreadWaitLists.css";

/*
 * What will wake the threads agent up in a thread: reminders, recurring
 * schedules and tasks it watches. Each line can be cancelled from a trash icon
 * shown on hover. The thread refreshes itself from the THREAD_UPDATED event the
 * backend sends after a cancellation.
 */

export const isReminder = (timer: ThreadTimerResponseDto) => timer.kind === "reminder";
export const isSchedule = (timer: ThreadTimerResponseDto) => timer.kind === "schedule";

/** A reminder at its time, in the browser's timezone. */
export function ThreadReminderList({
  threadId,
  reminders,
}: {
  threadId: string;
  reminders: ThreadTimerResponseDto[];
}): React.JSX.Element {
  return (
    <ul className="thread-wait-list">
      {reminders.map((reminder) => (
        <WaitRow
          key={reminder.id}
          icon={<AlarmClock size={14} aria-hidden="true" />}
          title={`Reminder at ${new Date(reminder.nextFireAt).toLocaleString()}`}
          lead={formatLocalTime(reminder.nextFireAt)}
          text={reminder.reason}
          removeLabel="Cancel reminder"
          onRemove={() => ThreadsService.ThreadsController_cancelTimer({ id: threadId, timerId: reminder.id })}
        />
      ))}
    </ul>
  );
}

export function ThreadScheduleList({
  threadId,
  schedules,
}: {
  threadId: string;
  schedules: ThreadTimerResponseDto[];
}): React.JSX.Element {
  return (
    <ul className="thread-wait-list">
      {schedules.map((schedule) => (
        <WaitRow
          key={schedule.id}
          icon={<Repeat size={14} aria-hidden="true" />}
          title={`Fired ${schedule.firedCount} of ${schedule.maxIterations} times. Next at ${new Date(schedule.nextFireAt).toLocaleString()}`}
          lead={`every ${formatPeriod(schedule.periodSeconds ?? 0)}`}
          text={schedule.reason}
          trail={`${schedule.firedCount}/${schedule.maxIterations}`}
          removeLabel="Cancel schedule"
          onRemove={() => ThreadsService.ThreadsController_cancelTimer({ id: threadId, timerId: schedule.id })}
        />
      ))}
    </ul>
  );
}

/** Tasks the threads agent is waiting to hear about: a compact list, not full task cards. */
export function ThreadTaskSubscriptionList({
  threadId,
  subscriptions,
}: {
  threadId: string;
  subscriptions: TaskSubscriptionResponseDto[];
}): React.JSX.Element {
  return (
    <ul className="thread-wait-list">
      {subscriptions.map((subscription) => (
        <WaitRow
          key={subscription.taskId}
          to={`/tasks/task/${subscription.taskId}`}
          icon={<BellRing size={14} aria-hidden="true" />}
          title="The agent is notified when this task is in review or done"
          text={subscription.name}
          trail={TASKS_STATUS[subscription.status as TaskStatus]?.label ?? subscription.status}
          removeLabel="Stop watching"
          onRemove={() =>
            ThreadsService.ThreadsController_removeTaskSubscription({ id: threadId, taskId: subscription.taskId })
          }
        />
      ))}
    </ul>
  );
}

function WaitRow({
  icon,
  lead,
  text,
  trail,
  title,
  to,
  removeLabel,
  onRemove,
}: {
  icon: React.ReactNode;
  lead?: string;
  text: string;
  trail?: string;
  title: string;
  to?: string;
  removeLabel: string;
  onRemove: () => Promise<void>;
}): React.JSX.Element {
  const [isRemoving, setIsRemoving] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = async () => {
    setIsRemoving(true);
    setFailed(false);
    try {
      await onRemove();
    } catch {
      setFailed(true);
      setIsRemoving(false);
    }
  };

  const body = (
    <>
      <span className="thread-wait-list__icon">{icon}</span>
      {lead && <span className="thread-wait-list__lead">{lead}</span>}
      <span className="thread-wait-list__text truncate">{text}</span>
      {trail && <span className="thread-wait-list__trail">{trail}</span>}
    </>
  );

  return (
    <li className={`thread-wait-list__row ${isRemoving ? "thread-wait-list__row--removing" : ""}`}>
      {to ? (
        <Link to={to} className="thread-wait-list__item" title={title}>
          {body}
        </Link>
      ) : (
        <div className="thread-wait-list__item" title={title}>
          {body}
        </div>
      )}
      <button
        type="button"
        className={`thread-wait-list__remove ${failed ? "thread-wait-list__remove--failed" : ""}`}
        onClick={() => void remove()}
        disabled={isRemoving}
        aria-label={removeLabel}
        title={failed ? `${removeLabel} failed. Try again.` : removeLabel}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/** "1:28 PM" today, "Fri 1:28 PM" within a week, otherwise "Oct 24, 1:28 PM". */
function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) {
    return time;
  }
  const days = (date.getTime() - now.getTime()) / 86_400_000;
  if (days > 0 && days < 6) {
    return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  }
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

/** "5 min", "2 h", "30 s": the largest unit that divides evenly, as the agent set it. */
function formatPeriod(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}
