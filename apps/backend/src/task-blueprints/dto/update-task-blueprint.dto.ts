import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskBlueprintDto {
  @ApiPropertyOptional({
    description: 'Name of the task blueprint',
    example: 'Daily standup task',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the task blueprint',
    example: 'Create a task for the daily standup meeting',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'ID or slug of the default assignee for tasks created from this blueprint',
    example: 'agent-alpha',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  assigneeActorId?: string | null;

  @ApiPropertyOptional({
    description: 'Array of tag names to associate with tasks created from this blueprint',
    example: ['daily', 'standup'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Array of task IDs that tasks created from this blueprint should depend on',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dependsOnIds?: string[];
}
