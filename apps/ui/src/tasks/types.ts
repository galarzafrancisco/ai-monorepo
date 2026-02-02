// Re-export types from shared package for ergonomics
export type {
  TaskResponseDto as Task,
  CommentResponseDto as Comment
} from "@taico/client"

import { TaskResponseDto } from "@taico/client";
export const TaskStatus = TaskResponseDto.status
