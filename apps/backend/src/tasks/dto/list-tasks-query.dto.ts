import { IsString, IsOptional, IsInt, Min, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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

  @ApiPropertyOptional({
    description: 'Filter tasks by tag name',
    example: 'bug',
  })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({
    description:
      'Only tasks whose ID starts with this (at least 4 hex digits, as shown in "#5fc5ec")',
    example: '5fc5ec',
  })
  @IsOptional()
  @Matches(/^[0-9a-fA-F-]{4,36}$/, {
    message: 'idPrefix must be 4 to 36 hex digits',
  })
  idPrefix?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (1-100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
