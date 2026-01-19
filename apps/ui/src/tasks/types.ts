// Re-export types from shared package for ergonomics
export type {
  TaskResponseDto as Task,
  CommentResponseDto as Comment
} from 'shared'

import { TaskResponseDto } from 'shared';
export const TaskStatus = TaskResponseDto.status
