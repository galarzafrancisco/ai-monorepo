import { ApiProperty } from '@nestjs/swagger';
import { TaskBlueprintResponseDto } from './task-blueprint-response.dto';
import { ListTaskBlueprintsResult } from './service/task-blueprints.service.types';

export class TaskBlueprintListResponseDto {
  @ApiProperty({
    description: 'List of task blueprints',
    type: [TaskBlueprintResponseDto],
  })
  items!: TaskBlueprintResponseDto[];

  @ApiProperty({
    description: 'Total number of task blueprints',
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

  static fromResult(result: ListTaskBlueprintsResult): TaskBlueprintListResponseDto {
    return {
      items: result.items.map((item) => TaskBlueprintResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
