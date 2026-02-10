import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateThreadDto {
  @ApiPropertyOptional({
    description: 'Title of the thread. If not provided, will be auto-generated.',
    example: 'Implement authentication feature',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Parent task ID - the task that this thread belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  parentTaskId!: string;

  @ApiPropertyOptional({
    description: 'Array of tag names to associate with the thread',
    example: ['bug', 'urgent'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Array of task IDs to attach to this thread',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  taskIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of context block IDs to reference in this thread',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contextBlockIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of actor IDs to add as participants',
    example: ['actor-uuid-1', 'actor-uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantActorIds?: string[];
}
