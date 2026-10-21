import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ThreadParamsDto } from './thread-params.dto';

export class ThreadTaskSubscriptionParamsDto extends ThreadParamsDto {
  @ApiProperty({
    description: 'UUID of the watched task',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  taskId!: string;
}
