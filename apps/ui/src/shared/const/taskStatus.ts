import { NavegationItem } from "../types/NavegationItem";

export const TaskStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  FOR_REVIEW: 'FOR_REVIEW',
  DONE: 'DONE',
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export type TaskStatusNavItem = NavegationItem & {
  status: TaskStatus;
};

export const TASKS_STATUS = {
  [TaskStatus.NOT_STARTED]: { path: '/tasks/not-started', label: 'Queued', icon: '📋' },
  [TaskStatus.IN_PROGRESS]: { path: '/tasks/in-progress', label: 'Building', icon: '👨🏻‍💻' },
  [TaskStatus.FOR_REVIEW]: { path: '/tasks/in-review', label: 'Review', icon: '👀' },
  [TaskStatus.DONE]: { path: '/tasks/done', label: 'Shipped', icon: '🚀' },
} as const satisfies Record<string, NavegationItem>;

export const TASKS_STATUS_NAV: NavegationItem[] = [
  TASKS_STATUS[TaskStatus.NOT_STARTED],
  TASKS_STATUS[TaskStatus.IN_PROGRESS],
  TASKS_STATUS[TaskStatus.FOR_REVIEW],
  TASKS_STATUS[TaskStatus.DONE],
];
