import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { TaskResponseDto } from './task-response.dto';

export class TaskListResponseDto {
  @ApiProperty({
    description: 'List of tasks',
    type: () => [TaskResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => TaskResponseDto)
  items!: TaskResponseDto[];

  @ApiProperty({
    description: 'Total number of tasks matching the filters',
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
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages!: number;
}
