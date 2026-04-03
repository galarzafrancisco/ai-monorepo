import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../../../tasks/enums';
import { ActiveTaskExecutionEntity } from '../../active-task-execution.entity';

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
    entity: ActiveTaskExecutionEntity,
  ): ActiveTaskExecutionResponseDto {
    return {
      id: entity.id,
      taskId: entity.taskId,
      taskName: entity.task?.name ?? null,
      taskStatus: entity.task?.status ?? null,
    };
  }
}
