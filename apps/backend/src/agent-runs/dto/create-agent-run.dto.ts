import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAgentRunDto {
  @ApiProperty({
    description: 'UUID of the parent task being executed',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsUUID()
  parentTaskId!: string;
}
