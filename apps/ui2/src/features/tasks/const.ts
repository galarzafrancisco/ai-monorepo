import { TaskResponseDto } from "shared";
import { NavegationItem } from "../../shared/types/NavegationItem";

export const TaskStatus = TaskResponseDto.status;
export type TaskStatus = TaskResponseDto.status;

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