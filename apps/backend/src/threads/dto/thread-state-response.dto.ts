import { ApiProperty } from '@nestjs/swagger';

export class ThreadStateResponseDto {
  @ApiProperty({
    description: 'Current state content of the thread',
    example: 'This thread was created to achieve task Implement authentication (id 123).\nDecision: Using JWT for authentication.',
  })
  content!: string;
}
