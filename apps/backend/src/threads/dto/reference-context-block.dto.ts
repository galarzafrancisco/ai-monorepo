import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReferenceContextBlockDto {
  @ApiProperty({
    description: 'Context block UUID to reference in the thread',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  contextBlockId!: string;
}
