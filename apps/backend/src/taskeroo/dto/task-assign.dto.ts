import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'Name of the assignee (can be empty to unassign)',
    example: 'AgentAlpha',
    required: false,
  })
  @IsString()
  @IsOptional()
  assignee?: string | null;

  @ApiProperty({
    description: 'Session ID for tracking AI agent work',
    example: 'session-123-abc',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
