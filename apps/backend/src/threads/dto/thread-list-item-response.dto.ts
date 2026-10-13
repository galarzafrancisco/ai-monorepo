import { ApiProperty } from '@nestjs/swagger';

export class ThreadListItemResponseDto {
  @ApiProperty({
    description: 'Thread ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Thread title',
    example: 'Implement authentication feature',
  })
  title!: string;

  @ApiProperty({
    description: 'State context block ID that tracks the evolving state of this thread',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stateContextBlockId!: string;

  @ApiProperty({
    description:
      'Messages in this thread written by someone else that the caller has not read yet',
    example: 2,
  })
  unreadCount!: number;
}
