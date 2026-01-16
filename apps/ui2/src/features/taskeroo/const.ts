import { TaskResponseDto } from 'shared';
import { InAppNavItem } from "../../shared/navigation";

export const TaskStatus = TaskResponseDto.status;
export type TaskStatus = TaskResponseDto.status;

export interface StatusConfig extends InAppNavItem {
  status: TaskResponseDto.status;
}

export const STATUS_CONFIG: Record<TaskResponseDto.status, InAppNavItem> = {
  [TaskStatus.NOT_STARTED]: { path: '/taskeroo/not-started', label: 'Queued', icon: '📋' },
  [TaskStatus.IN_PROGRESS]: { path: '/taskeroo/in-progress', label: 'Building', icon: '👨🏻‍💻' },
  [TaskStatus.FOR_REVIEW]: { path: '/taskeroo/in-review', label: 'Review', icon: '👀' },
  [TaskStatus.DONE]: { path: '/taskeroo/done', label: 'Shipped', icon: '🚀' },
};
