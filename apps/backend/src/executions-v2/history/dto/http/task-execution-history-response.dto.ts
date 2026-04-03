import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import { TaskExecutionHistoryEntity } from '../../task-execution-history.entity';

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

  static fromEntity(
    entity: TaskExecutionHistoryEntity,
  ): TaskExecutionHistoryResponseDto {
    return {
      id: entity.id,
      taskId: entity.taskId,
      taskName: entity.task?.name ?? null,
      taskStatus: entity.task?.status ?? null,
    };
  }
}
