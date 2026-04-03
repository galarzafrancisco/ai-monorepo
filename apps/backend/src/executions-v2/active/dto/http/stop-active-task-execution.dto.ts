import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskExecutionHistoryErrorCode } from '../../../history/task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from '../../../history/task-execution-history-status.enum';

export class StopActiveTaskExecutionDto {
  @ApiProperty({
    description: 'Actor id of the agent that worked on the task',
    example: '19dc147c-6051-49e3-bf7a-404e3bb575d3',
  })
  @IsUUID()
  agentActorId!: string;

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
}
