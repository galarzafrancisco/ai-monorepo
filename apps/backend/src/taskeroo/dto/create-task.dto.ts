import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Name of the task',
    example: 'Implement user authentication',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Detailed description of the task',
    example: 'Add JWT-based authentication to the API',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'Name of the assignee (for AI agents)',
    example: 'AgentAlpha',
  })
  @IsString()
  @IsOptional()
  assignee?: string;

  @ApiPropertyOptional({
    description: 'Session ID for tracking AI agent work',
    example: 'session-123-abc',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Array of tag names to associate with the task',
    example: ['bug', 'urgent'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Name of the person who created the task (auto-populated from authenticated user if not provided)',
    example: 'Fran',
  })
  @IsString()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Array of task IDs that this task depends on',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dependsOnIds?: string[];
}
