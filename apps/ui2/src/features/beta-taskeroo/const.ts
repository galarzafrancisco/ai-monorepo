import { TaskResponseDto } from "shared";
import { NavegationItem } from "../../shared/types/NavegationItem";

export const TaskStatus = TaskResponseDto.status;
export type TaskStatus = TaskResponseDto.status;

export type TaskStatusNavItem = NavegationItem & {
  status: TaskStatus;
};

export const TASKEROO_STATUS = {
  [TaskStatus.NOT_STARTED]: { path: '/taskeroo/not-started', label: 'Queued', icon: '📋' },
  [TaskStatus.IN_PROGRESS]: { path: '/taskeroo/in-progress', label: 'Building', icon: '👨🏻‍💻' },
  [TaskStatus.FOR_REVIEW]: { path: '/taskeroo/in-review', label: 'Review', icon: '👀' },
  [TaskStatus.DONE]: { path: '/taskeroo/done', label: 'Shipped', icon: '🚀' },
} as const satisfies Record<string, NavegationItem>;

export const TASKEROO_STATUS_NAV: NavegationItem[] = [
  TASKEROO_STATUS[TaskStatus.NOT_STARTED],
  TASKEROO_STATUS[TaskStatus.IN_PROGRESS],
  TASKEROO_STATUS[TaskStatus.FOR_REVIEW],
  TASKEROO_STATUS[TaskStatus.DONE],
];