import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ThreadWatchParamsDto {
  @ApiProperty({ description: 'Thread ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Watch ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  watchId!: string;
}
