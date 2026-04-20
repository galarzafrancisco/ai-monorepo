import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ActiveTaskExecutionResponseDto } from './active-task-execution-response.dto';

export class ActiveTaskExecutionListResponseDto {
  @ApiProperty({
    description: 'List of active task executions',
    type: () => [ActiveTaskExecutionResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => ActiveTaskExecutionResponseDto)
  items!: ActiveTaskExecutionResponseDto[];

  @ApiProperty({
    description: 'Total number of active executions',
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
