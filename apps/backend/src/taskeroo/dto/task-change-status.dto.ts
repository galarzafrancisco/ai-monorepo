import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums';

export class TaskChangeStatusDto {
  @ApiProperty({
    description: 'New status for the task',
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
  })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional({
    description: 'Comment required when marking task as done',
    example: 'All requirements met and tests passing',
  })
  @IsString()
  @IsOptional()
  comment?: string;
}
