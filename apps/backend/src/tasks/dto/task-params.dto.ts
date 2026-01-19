import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TaskParamsDto {
  @ApiProperty({
    description: 'Task UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  id!: string;
}
