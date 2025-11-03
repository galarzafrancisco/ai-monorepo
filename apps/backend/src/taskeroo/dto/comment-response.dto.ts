import { ApiProperty } from '@nestjs/swagger';

export class CommentResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the comment',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the task this comment belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId!: string;

  @ApiProperty({
    description: 'Name of the person/agent who created the comment',
    example: 'AgentAlpha',
  })
  commenterName!: string;

  @ApiProperty({
    description: 'Content of the comment',
    example: 'Started working on this task',
  })
  content!: string;

  @ApiProperty({
    description: 'Comment creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;
}
