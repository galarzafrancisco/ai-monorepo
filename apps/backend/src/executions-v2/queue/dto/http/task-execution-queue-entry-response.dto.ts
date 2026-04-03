import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import { TaskExecutionQueueEntity } from '../../task-execution-queue.entity';

export class TaskExecutionQueueEntryResponseDto {
  @ApiProperty({
    description: 'Task ID present in the execution queue',
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
    entity: TaskExecutionQueueEntity,
  ): TaskExecutionQueueEntryResponseDto {
    return {
      taskId: entity.taskId,
      taskName: entity.task?.name ?? null,
      taskStatus: entity.task?.status ?? null,
    };
  }
}
