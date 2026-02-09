import { ApiProperty } from '@nestjs/swagger';

export class ThreadStateResponseDto {
  @ApiProperty({
    description: 'Thread ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'State context block ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stateContextBlockId!: string;

  @ApiProperty({
    description: 'Current state content',
    example: 'This thread is tracking the implementation of feature X.',
  })
  content!: string;
}
