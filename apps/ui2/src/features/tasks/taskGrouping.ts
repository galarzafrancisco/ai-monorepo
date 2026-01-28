import { Task } from "./types";

export interface TaskGroup {
  date: Date;
  dateKey: string;
  tasks: Task[];
  isToday: boolean;
}

/**
 * Groups tasks by day based on their updatedAt timestamp.
 * Returns an array of groups sorted by date (most recent first).
 */
export function groupTasksByDay(tasks: Task[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    const taskDate = new Date(task.updatedAt);
    taskDate.setHours(0, 0, 0, 0);

    const dateKey = taskDate.toISOString().split('T')[0];
    const isToday = taskDate.getTime() === today.getTime();

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: taskDate,
        dateKey,
        tasks: [],
        isToday,
      });
    }

    groups.get(dateKey)!.tasks.push(task);
  }

  // Sort groups by date (most recent first)
  return Array.from(groups.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

/**
 * Formats a date for display in the summary row.
 * Examples: "Today", "Yesterday", "Jan 15", "Dec 31, 2024"
 */
export function formatGroupDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) {
    return "Today";
  } else if (taskDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  const currentYear = today.getFullYear();
  const taskYear = taskDate.getFullYear();

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[taskDate.getMonth()];
  const day = taskDate.getDate();

  if (taskYear === currentYear) {
    return `${month} ${day}`;
  } else {
    return `${month} ${day}, ${taskYear}`;
  }
}
