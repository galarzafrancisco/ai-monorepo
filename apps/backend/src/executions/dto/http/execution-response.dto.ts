import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskExecutionStatus } from '../../enums';
import { ExecutionResult } from '../service/executions.service.types';

/**
 * Response DTO for a single task execution
 */
export class ExecutionResponseDto {
  @ApiProperty({
    description: 'Unique execution identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  taskId!: string;

  @ApiPropertyOptional({
    description: 'Task name',
    example: 'Implement feature X',
    nullable: true,
    type: String,
  })
  taskName!: string | null;

  @ApiProperty({
    description: 'Agent actor ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  agentActorId!: string;

  @ApiPropertyOptional({
    description: 'Agent slug',
    example: 'claude-dev',
    nullable: true,
    type: String,
  })
  agentSlug!: string | null;

  @ApiPropertyOptional({
    description: 'Agent name',
    example: 'Claude Developer',
    nullable: true,
    type: String,
  })
  agentName!: string | null;

  @ApiProperty({
    description: 'Execution status',
    enum: TaskExecutionStatus,
    example: TaskExecutionStatus.READY,
  })
  status!: TaskExecutionStatus;

  @ApiProperty({
    description: 'When the execution was requested',
    example: '2026-03-28T10:30:00.000Z',
  })
  requestedAt!: string;

  @ApiPropertyOptional({
    description: 'When the execution was claimed by a worker',
    example: '2026-03-28T10:31:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  claimedAt!: string | null;

  @ApiPropertyOptional({
    description: 'When the execution started running',
    example: '2026-03-28T10:31:05.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  startedAt!: string | null;

  @ApiPropertyOptional({
    description: 'When the execution finished',
    example: '2026-03-28T10:35:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  finishedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Worker session ID that claimed this execution',
    example: '123e4567-e89b-12d3-a456-426614174003',
    nullable: true,
    type: String,
  })
  workerSessionId!: string | null;

  @ApiPropertyOptional({
    description: 'When the worker lease expires',
    example: '2026-03-28T10:36:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  leaseExpiresAt!: string | null;

  @ApiPropertyOptional({
    description: 'When a stop was requested',
    example: '2026-03-28T10:34:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  stopRequestedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Failure reason if execution failed',
    example: 'Worker disconnected',
    nullable: true,
    type: String,
  })
  failureReason!: string | null;

  @ApiPropertyOptional({
    description: 'Why this execution was triggered',
    example: 'Task is eligible for execution',
    nullable: true,
    type: String,
  })
  triggerReason!: string | null;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'Execution creation timestamp',
    example: '2026-03-28T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Execution last update timestamp',
    example: '2026-03-28T10:30:00.000Z',
  })
  updatedAt!: string;

  /**
   * Factory method to create an ExecutionResponseDto from an ExecutionResult.
   */
  static fromResult(result: ExecutionResult): ExecutionResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      taskName: result.taskName,
      agentActorId: result.agentActorId,
      agentSlug: result.agentSlug,
      agentName: result.agentName,
      status: result.status,
      requestedAt: result.requestedAt.toISOString(),
      claimedAt: result.claimedAt ? result.claimedAt.toISOString() : null,
      startedAt: result.startedAt ? result.startedAt.toISOString() : null,
      finishedAt: result.finishedAt ? result.finishedAt.toISOString() : null,
      workerSessionId: result.workerSessionId,
      leaseExpiresAt: result.leaseExpiresAt
        ? result.leaseExpiresAt.toISOString()
        : null,
      stopRequestedAt: result.stopRequestedAt
        ? result.stopRequestedAt.toISOString()
        : null,
      failureReason: result.failureReason,
      triggerReason: result.triggerReason,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
