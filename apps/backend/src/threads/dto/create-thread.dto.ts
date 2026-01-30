import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateThreadDto {
  @ApiPropertyOptional({
    description: 'Title of the thread. If not provided, will be auto-generated.',
    example: 'Implement authentication feature',
  })
  @IsString()
  @IsOptional()
  title?: string;

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
