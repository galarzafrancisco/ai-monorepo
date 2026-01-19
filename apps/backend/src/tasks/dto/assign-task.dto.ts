import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'Actor ID of the assignee',
    example: '1111-2222-3333',
    required: false,
  })
  @IsString()
  assigneeActorId!: string;

  @ApiProperty({
    description: 'Session ID for tracking AI agent work',
    example: 'session-123-abc',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
