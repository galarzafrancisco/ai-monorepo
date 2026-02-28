import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
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
    description: 'Number of tasks to fetch per status column',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  columnLimit?: number = 50;

  @ApiPropertyOptional({
    description: 'Keyset cursor for NOT_STARTED column',
    example: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtMSJ9',
  })
  @IsString()
  @IsOptional()
  notStartedCursor?: string;

  @ApiPropertyOptional({
    description: 'Keyset cursor for IN_PROGRESS column',
    example: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtMiJ9',
  })
  @IsString()
  @IsOptional()
  inProgressCursor?: string;

  @ApiPropertyOptional({
    description: 'Keyset cursor for FOR_REVIEW column',
    example: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtMyJ9',
  })
  @IsString()
  @IsOptional()
  forReviewCursor?: string;

  @ApiPropertyOptional({
    description: 'Keyset cursor for DONE column',
    example: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtNCJ9',
  })
  @IsString()
  @IsOptional()
  doneCursor?: string;
}
