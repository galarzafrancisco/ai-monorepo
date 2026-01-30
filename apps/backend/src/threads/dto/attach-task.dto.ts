import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachTaskDto {
  @ApiProperty({
    description: 'Task UUID to attach to the thread',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  taskId!: string;
}
