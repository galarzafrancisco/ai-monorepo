import { ApiProperty } from '@nestjs/swagger';
import { ExecutionResponseDto } from './execution-response.dto';

/**
 * Response DTO for listing task executions with pagination
 */
export class ExecutionListResponseDto {
  @ApiProperty({
    description: 'Array of task executions',
    type: [ExecutionResponseDto],
  })
  items!: ExecutionResponseDto[];

  @ApiProperty({
    description: 'Total number of executions matching the filter',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number (1-indexed)',
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
    example: 2,
  })
  totalPages!: number;
}
