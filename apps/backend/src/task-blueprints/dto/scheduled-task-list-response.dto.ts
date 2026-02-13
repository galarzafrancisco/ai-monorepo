import { ApiProperty } from '@nestjs/swagger';
import { ScheduledTaskResponseDto } from './scheduled-task-response.dto';
import { ListScheduledTasksResult } from './service/scheduled-tasks.service.types';

export class ScheduledTaskListResponseDto {
  @ApiProperty({
    description: 'List of scheduled tasks',
    type: [ScheduledTaskResponseDto],
  })
  items!: ScheduledTaskResponseDto[];

  @ApiProperty({
    description: 'Total number of scheduled tasks',
    example: 10,
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

  static fromResult(result: ListScheduledTasksResult): ScheduledTaskListResponseDto {
    return {
      items: result.items.map((item) => ScheduledTaskResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
