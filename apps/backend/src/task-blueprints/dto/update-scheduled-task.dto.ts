import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduledTaskDto {
  @ApiPropertyOptional({
    description: 'Cron expression for scheduling (e.g., "0 9 * * 1-5" for weekdays at 9am)',
    example: '0 9 * * *',
  })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Whether the scheduled task is enabled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
