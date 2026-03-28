import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601, IsUUID } from 'class-validator';

export class UpdateAgentRunDto {
  @ApiPropertyOptional({
    description: 'Timestamp when the run started',
    example: '2026-01-30T10:30:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the run ended',
    example: '2026-01-30T10:45:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the last ping/heartbeat',
    example: '2026-01-30T10:40:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  lastPing?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the associated TaskExecution (for new execution-centric paths)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  taskExecutionId?: string;
}
