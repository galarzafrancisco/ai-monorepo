import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter tasks by assignee name',
    example: 'AgentAlpha',
  })
  @IsString()
  @IsOptional()
  assignee?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks by session ID',
    example: 'session-123-abc',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
