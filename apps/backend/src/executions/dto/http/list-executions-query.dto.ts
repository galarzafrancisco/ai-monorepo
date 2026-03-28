import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskExecutionStatus } from '../../enums';

/**
 * Query parameters for listing task executions
 */
export class ListExecutionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by execution status',
    enum: TaskExecutionStatus,
    example: TaskExecutionStatus.READY,
  })
  @IsOptional()
  @IsEnum(TaskExecutionStatus)
  status?: TaskExecutionStatus;

  @ApiPropertyOptional({
    description: 'Filter by agent actor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  agentActorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by task ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
