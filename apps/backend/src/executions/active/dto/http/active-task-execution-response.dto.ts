import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import {
  ActiveTaskExecutionResult,
  ActiveTaskExecutionTagSnapshotResult,
} from '../../../dto/service/execution-results.service.types';
import { ExecutionStatsResponseDto } from '../../../dto/http/execution-stats-response.dto';

class ActiveTaskExecutionTagSnapshotResponseDto {
  @ApiProperty({
    description: 'Tag ID at the time the task was claimed',
    example: 'd2dce6f1-24ec-47cc-b7fd-11a4e2672ad7',
  })
  id!: string;

  @ApiProperty({
    description: 'Tag name at the time the task was claimed',
    example: 'backend',
  })
  name!: string;

  static fromSnapshot(
    snapshot: ActiveTaskExecutionTagSnapshotResult,
  ): ActiveTaskExecutionTagSnapshotResponseDto {
    return {
      id: snapshot.id,
      name: snapshot.name,
    };
  }
}

export class ActiveTaskExecutionResponseDto {
  @ApiProperty({
    description: 'Execution ID',
    example: 'b8f98a43-a5d1-42a5-a64d-934da729e8f8',
  })
  id!: string;

  @ApiProperty({
    description: 'Task ID for the active execution',
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
    description: 'When the task was claimed into the active table',
    example: '2026-04-03T08:25:00.000Z',
  })
  claimedAt!: string;

  @ApiProperty({
    type: String,
    description: 'Latest worker heartbeat received for this active execution',
    example: '2026-04-03T08:25:10.000Z',
    nullable: true,
  })
  lastHeartbeatAt!: string | null;

  @ApiProperty({
    type: String,
    description: 'Agent runtime session identifier associated with this execution',
    example: 'session_01JZ0SMM85FBFA8Y82M8VREY2A',
    nullable: true,
  })
  runnerSessionId!: string | null;

  @ApiProperty({
    description: 'Number of tool calls made during this execution so far',
    example: 7,
  })
  toolCallCount!: number;

  @ApiProperty({
    description: 'Task status before the task was claimed',
    enum: TaskStatus,
  })
  taskStatusBeforeClaim!: TaskStatus;

  @ApiProperty({
    description: 'Task tags before the task was claimed',
    type: [ActiveTaskExecutionTagSnapshotResponseDto],
  })
  taskTagsBeforeClaim!: ActiveTaskExecutionTagSnapshotResponseDto[];

  @ApiProperty({
    description: 'OAuth client id of the worker that claimed the task',
    example: '24f52f295c990c1d6cdc6034fa3d1900',
  })
  workerClientId!: string;

  @ApiProperty({
    type: String,
    description: 'Task assignee actor id before the task was claimed',
    example: '19dc147c-6051-49e3-bf7a-404e3bb575d3',
    nullable: true,
  })
  taskAssigneeActorIdBeforeClaim!: string | null;

  @ApiProperty({
    description: 'Agent actor id that picked up the task',
    example: '19dc147c-6051-49e3-bf7a-404e3bb575d3',
  })
  agentActorId!: string;

  @ApiProperty({
    description: 'Execution metadata and usage stats',
    type: ExecutionStatsResponseDto,
    nullable: true,
  })
  stats!: ExecutionStatsResponseDto | null;

  static fromResult(
    result: ActiveTaskExecutionResult,
  ): ActiveTaskExecutionResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      taskName: result.taskName,
      taskStatus: result.taskStatus,
      claimedAt: result.claimedAt.toISOString(),
      lastHeartbeatAt: result.lastHeartbeatAt?.toISOString() ?? null,
      runnerSessionId: result.runnerSessionId,
      toolCallCount: result.toolCallCount,
      taskStatusBeforeClaim: result.taskStatusBeforeClaim,
      taskTagsBeforeClaim: result.taskTagsBeforeClaim.map((tag) =>
        ActiveTaskExecutionTagSnapshotResponseDto.fromSnapshot(tag),
      ),
      workerClientId: result.workerClientId,
      taskAssigneeActorIdBeforeClaim: result.taskAssigneeActorIdBeforeClaim,
      agentActorId: result.agentActorId,
      stats: result.stats ? ExecutionStatsResponseDto.fromResult(result.stats) : null,
    };
  }
}
