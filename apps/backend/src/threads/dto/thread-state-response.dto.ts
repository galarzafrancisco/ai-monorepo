import { ApiProperty } from '@nestjs/swagger';
import { ThreadStateResult } from './service/threads.service.types';

export class ThreadStateResponseDto {
  @ApiProperty({
    description: 'Thread ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Context block ID for thread state',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stateContextBlockId!: string;

  @ApiProperty({
    description: 'Current thread state content',
    example: 'This thread was created to track work.',
  })
  content!: string;

  @ApiProperty({
    description: 'When the thread state was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: string;

  static fromResult(result: ThreadStateResult): ThreadStateResponseDto {
    return {
      threadId: result.threadId,
      stateContextBlockId: result.stateContextBlockId,
      content: result.content,
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
