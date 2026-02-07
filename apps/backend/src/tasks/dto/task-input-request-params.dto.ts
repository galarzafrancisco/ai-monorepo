import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TaskInputRequestParamsDto {
  @ApiProperty({
    description: 'Task UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  id!: string;

  @ApiProperty({
    description: 'Input request UUID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID('4')
  inputRequestId!: string;
}
