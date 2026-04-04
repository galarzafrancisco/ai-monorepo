import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import {
  ActiveTaskExecutionEntity,
  type ActiveTaskExecutionTagSnapshot,
} from '../../active-task-execution.entity';

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
    snapshot: ActiveTaskExecutionTagSnapshot,
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

  static fromEntity(
    entity: ActiveTaskExecutionEntity,
  ): ActiveTaskExecutionResponseDto {
    return {
      id: entity.id,
      taskId: entity.taskId,
      taskName: entity.task?.name ?? null,
      taskStatus: entity.task?.status ?? null,
      claimedAt: entity.claimedAt.toISOString(),
      taskStatusBeforeClaim: entity.taskStatusBeforeClaim,
      taskTagsBeforeClaim: entity.taskTagsBeforeClaim.map((tag) =>
        ActiveTaskExecutionTagSnapshotResponseDto.fromSnapshot(tag),
      ),
      workerClientId: entity.workerClientId,
      taskAssigneeActorIdBeforeClaim: entity.taskAssigneeActorIdBeforeClaim,
      agentActorId: entity.agentActorId,
    };
  }
}
