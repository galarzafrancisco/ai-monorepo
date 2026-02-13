import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduledTaskDto {
  @ApiProperty({
    description: 'ID of the task blueprint to schedule',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  taskBlueprintId!: string;

  @ApiProperty({
    description: 'Cron expression for scheduling (e.g., "0 9 * * 1-5" for weekdays at 9am)',
    example: '0 9 * * *',
  })
  @IsString()
  @IsNotEmpty()
  cronExpression!: string;

  @ApiPropertyOptional({
    description: 'Whether the scheduled task is enabled',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
