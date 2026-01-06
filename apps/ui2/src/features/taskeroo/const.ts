import { TaskStatus } from "./types";

export const STATUS_CONFIG = [
  { status: TaskStatus.NOT_STARTED, path: '/taskeroo/not-started', label: 'Queued', icon: '📋' },
  { status: TaskStatus.IN_PROGRESS, path: '/taskeroo/in-progress', label: 'Building', icon: '👨🏻‍💻' },
  { status: TaskStatus.FOR_REVIEW, path: '/taskeroo/in-review', label: 'Review', icon: '👀' },
  { status: TaskStatus.DONE, path: '/taskeroo/done', label: 'Shipped', icon: '🚀' },
];