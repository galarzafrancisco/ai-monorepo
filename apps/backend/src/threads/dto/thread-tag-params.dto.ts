import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ThreadTagParamsDto {
  @ApiProperty({
    description: 'Thread UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  id!: string;

  @ApiProperty({
    description: 'Tag UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID('4')
  tagId!: string;
}
