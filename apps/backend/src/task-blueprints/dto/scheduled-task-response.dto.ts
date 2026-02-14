import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskBlueprintResponseDto } from './task-blueprint-response.dto';
import { ScheduledTaskResult } from './service/scheduled-tasks.service.types';

export class ScheduledTaskResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the scheduled task',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the task blueprint',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskBlueprintId!: string;

  @ApiPropertyOptional({
    description: 'The task blueprint details',
    type: () => TaskBlueprintResponseDto,
  })
  taskBlueprint?: TaskBlueprintResponseDto;

  @ApiProperty({
    description: 'Cron expression for scheduling',
    example: '0 9 * * *',
  })
  cronExpression!: string;

  @ApiProperty({
    description: 'Whether the scheduled task is enabled',
    example: true,
  })
  enabled!: boolean;

  @ApiPropertyOptional({
    description: 'Last execution timestamp',
    example: '2025-11-03T09:00:00.000Z',
    nullable: true,
  })
  lastRunAt!: string | null;

  @ApiProperty({
    description: 'Next scheduled execution timestamp',
    example: '2025-11-04T09:00:00.000Z',
  })
  nextRunAt!: string;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'Scheduled task creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Scheduled task last update timestamp',
    example: '2025-11-03T12:45:00.000Z',
  })
  updatedAt!: string;

  static fromResult(result: ScheduledTaskResult): ScheduledTaskResponseDto {
    return {
      id: result.id,
      taskBlueprintId: result.taskBlueprintId,
      taskBlueprint: result.taskBlueprint
        ? TaskBlueprintResponseDto.fromResult(result.taskBlueprint)
        : undefined,
      cronExpression: result.cronExpression,
      enabled: result.enabled,
      lastRunAt: result.lastRunAt ? result.lastRunAt.toISOString() : null,
      nextRunAt: result.nextRunAt.toISOString(),
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
