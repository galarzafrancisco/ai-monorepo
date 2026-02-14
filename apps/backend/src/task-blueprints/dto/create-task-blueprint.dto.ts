import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskBlueprintDto {
  @ApiProperty({
    description: 'Name of the task blueprint',
    example: 'Daily standup task',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Detailed description of the task blueprint',
    example: 'Create a task for the daily standup meeting',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'ID or slug of the default assignee for tasks created from this blueprint',
    example: 'agent-alpha',
  })
  @IsString()
  @IsOptional()
  assigneeActorId?: string;

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
