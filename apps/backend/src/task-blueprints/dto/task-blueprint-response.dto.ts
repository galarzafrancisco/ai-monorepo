import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { TagResponseDto } from '../../tasks/dto/tag-response.dto';
import { TaskBlueprintResult } from './service/task-blueprints.service.types';

export class TaskBlueprintResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the task blueprint',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the task blueprint',
    example: 'Daily standup task',
  })
  name!: string;

  @ApiProperty({
    description: 'Detailed description of the task blueprint',
    example: 'Create a task for the daily standup meeting',
  })
  description!: string;

  @ApiPropertyOptional({
    description: 'ID of the default assignee for tasks created from this blueprint',
    example: '111-222-333',
    nullable: true,
  })
  assigneeActorId!: string | null;

  @ApiPropertyOptional({
    description: 'Actor assigned to tasks created from this blueprint',
    type: () => ActorResponseDto,
    nullable: true,
  })
  assigneeActor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'Tags associated with tasks created from this blueprint',
    type: () => [TagResponseDto],
  })
  tags!: TagResponseDto[];

  @ApiProperty({
    description: 'Array of task IDs that tasks created from this blueprint should depend on',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  dependsOnIds!: string[];

  @ApiProperty({
    description: 'Actor who created this task blueprint',
    type: () => ActorResponseDto,
  })
  createdByActor!: ActorResponseDto;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'Blueprint creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Blueprint last update timestamp',
    example: '2025-11-03T12:45:00.000Z',
  })
  updatedAt!: string;

  static fromResult(result: TaskBlueprintResult): TaskBlueprintResponseDto {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      assigneeActorId: result.assigneeActorId,
      assigneeActor: result.assigneeActor
        ? ActorResponseDto.fromResult(result.assigneeActor)
        : null,
      tags: result.tags.map((t) => TagResponseDto.fromResult(t)),
      dependsOnIds: result.dependsOnIds,
      createdByActor: ActorResponseDto.fromResult(result.createdByActor),
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
