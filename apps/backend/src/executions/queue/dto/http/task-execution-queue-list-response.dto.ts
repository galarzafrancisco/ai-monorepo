import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { TaskExecutionQueueEntryResponseDto } from './task-execution-queue-entry-response.dto';

export class TaskExecutionQueueListResponseDto {
  @ApiProperty({
    description: 'List of task execution queue entries',
    type: () => [TaskExecutionQueueEntryResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => TaskExecutionQueueEntryResponseDto)
  items!: TaskExecutionQueueEntryResponseDto[];

  @ApiProperty({
    description: 'Total number of queue entries',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages!: number;
}
