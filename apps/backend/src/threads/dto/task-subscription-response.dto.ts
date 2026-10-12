import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../tasks/enums';
import { TaskSubscriptionResult } from './service/threads.service.types';

export class TaskSubscriptionResponseDto {
  @ApiProperty({
    description: 'ID of the task the thread is subscribed to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId!: string;

  @ApiProperty({
    description: 'Task name',
    example: 'Find public holidays',
  })
  name!: string;

  @ApiProperty({
    description: 'Current task status',
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
  })
  status!: TaskStatus;

  @ApiProperty({
    description: 'When the thread subscribed to the task',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  static fromResult(result: TaskSubscriptionResult): TaskSubscriptionResponseDto {
    return {
      taskId: result.taskId,
      name: result.name,
      status: result.status,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
