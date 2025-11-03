import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
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
}
