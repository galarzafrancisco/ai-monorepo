import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { TaskExecutionHistoryResponseDto } from './task-execution-history-response.dto';

export class TaskExecutionHistoryListResponseDto {
  @ApiProperty({
    description: 'List of task execution history entries',
    type: () => [TaskExecutionHistoryResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => TaskExecutionHistoryResponseDto)
  items!: TaskExecutionHistoryResponseDto[];

  @ApiProperty({
    description: 'Total number of history entries',
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
