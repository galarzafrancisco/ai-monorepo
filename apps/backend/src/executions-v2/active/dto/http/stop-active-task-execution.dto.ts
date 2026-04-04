import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskExecutionHistoryErrorCode } from '../../../history/task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from '../../../history/task-execution-history-status.enum';

export class StopActiveTaskExecutionDto {
  @ApiProperty({
    description: 'Terminal execution status',
    enum: TaskExecutionHistoryStatus,
    example: TaskExecutionHistoryStatus.SUCCEEDED,
  })
  @IsEnum(TaskExecutionHistoryStatus)
  status!: TaskExecutionHistoryStatus;

  @ApiProperty({
    description: 'Optional error code for failed execution outcomes',
    enum: TaskExecutionHistoryErrorCode,
    nullable: true,
    required: false,
    example: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
  })
  @IsOptional()
  @IsEnum(TaskExecutionHistoryErrorCode)
  errorCode?: TaskExecutionHistoryErrorCode | null;

  @ApiProperty({
    type: String,
    description: 'Optional human-readable error message for failed or cancelled executions',
    nullable: true,
    required: false,
    example: 'ADK runner failed: 429 quota exceeded.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string | null;
}
