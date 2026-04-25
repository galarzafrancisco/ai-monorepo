import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import { TaskExecutionHistoryErrorCode } from '../../task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from '../../task-execution-history-status.enum';
import { ExecutionStatsResponseDto } from '../../../dto/http/execution-stats-response.dto';
import { TaskExecutionHistoryResult } from '../../../dto/service/execution-results.service.types';

export class TaskExecutionHistoryResponseDto {
  @ApiProperty({
    description: 'History row ID',
    example: 'dfc3932c-a151-4f67-9959-c720fed08d90',
  })
  id!: string;

  @ApiProperty({
    description: 'Task ID for the historical execution',
    example: '8c9d2c6c-2e2f-49eb-a7f7-5d483b7f0f1f',
  })
  taskId!: string;

  @ApiProperty({
    type: String,
    description: 'Task name at the time of retrieval',
    example: 'Investigate worker auth flow',
    nullable: true,
  })
  taskName!: string | null;

  @ApiProperty({
    description: 'Current task status',
    enum: TaskStatus,
    nullable: true,
  })
  taskStatus!: TaskStatus | null;

  @ApiProperty({
    description: 'When the task was originally claimed',
    example: '2026-04-03T08:25:00.000Z',
  })
  claimedAt!: string;

  @ApiProperty({
    description: 'When the active execution transitioned into history',
    example: '2026-04-03T08:40:00.000Z',
  })
  transitionedAt!: string;

  @ApiProperty({
    description: 'Actor id of the agent that worked on the task',
    example: '19dc147c-6051-49e3-bf7a-404e3bb575d3',
  })
  agentActorId!: string;

  @ApiProperty({
    description: 'OAuth client id of the worker that executed the task',
    example: '24f52f295c990c1d6cdc6034fa3d1900',
  })
  workerClientId!: string;

  @ApiProperty({
    type: String,
    description: 'Agent runtime session identifier associated with this execution',
    example: 'session_01JZ0SMM85FBFA8Y82M8VREY2A',
    nullable: true,
  })
  runnerSessionId!: string | null;

  @ApiProperty({
    description: 'Number of tool calls made during the execution',
    example: 12,
  })
  toolCallCount!: number;

  @ApiProperty({
    description: 'Terminal execution status',
    enum: TaskExecutionHistoryStatus,
  })
  status!: TaskExecutionHistoryStatus;

  @ApiProperty({
    description: 'Optional failure code when execution ended with an error',
    enum: TaskExecutionHistoryErrorCode,
    nullable: true,
  })
  errorCode!: TaskExecutionHistoryErrorCode | null;

  @ApiProperty({
    type: String,
    description: 'Optional human-readable error message for failed or cancelled executions',
    nullable: true,
    example: 'ADK runner failed: 429 quota exceeded.',
  })
  errorMessage!: string | null;

  @ApiProperty({
    description: 'Execution metadata and usage stats',
    type: ExecutionStatsResponseDto,
    nullable: true,
  })
  stats!: ExecutionStatsResponseDto | null;

  static fromResult(
    result: TaskExecutionHistoryResult,
  ): TaskExecutionHistoryResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      taskName: result.taskName,
      taskStatus: result.taskStatus,
      claimedAt: result.claimedAt.toISOString(),
      transitionedAt: result.transitionedAt.toISOString(),
      agentActorId: result.agentActorId,
      workerClientId: result.workerClientId,
      runnerSessionId: result.runnerSessionId,
      toolCallCount: result.toolCallCount,
      status: result.status,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      stats: result.stats ? ExecutionStatsResponseDto.fromResult(result.stats) : null,
    };
  }
}
