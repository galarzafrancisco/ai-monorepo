/**
 * Task status enum
 *
 * Represents the lifecycle states of a task.
 * Centralized enum that can be shared across layers.
 */
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  FOR_REVIEW = 'FOR_REVIEW',
  DONE = 'DONE',
}
