import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { TaskStatus } from '../enums';
import { CommentResponseDto } from './comment-response.dto';

export class TaskResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the task',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the task',
    example: 'Implement user authentication',
  })
  name!: string;

  @ApiProperty({
    description: 'Detailed description of the task',
    example: 'Add JWT-based authentication to the API',
  })
  description!: string;

  @ApiProperty({
    description: 'Current status of the task',
    enum: TaskStatus,
    example: TaskStatus.NOT_STARTED,
  })
  status!: TaskStatus;

  @ApiPropertyOptional({
    description: 'Name of the assignee (for AI agents)',
    example: 'AgentAlpha',
    nullable: true,
  })
  assignee!: string;

  @ApiPropertyOptional({
    description: 'Session ID for tracking AI agent work',
    example: 'session-123-abc',
    nullable: true,
  })
  sessionId!: string;

  @ApiProperty({
    description: 'Comments associated with the task',
    type: () => [CommentResponseDto],
    example: [
      {
        id: 'cmt-001',
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        commenterName: 'John Doe',
        content: 'Please prioritize this task.',
        createdAt: '2025-11-03T11:00:00.000Z',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => CommentResponseDto)
  comments!: CommentResponseDto[];

  @ApiProperty({
    description: 'Task creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Task last update timestamp',
    example: '2025-11-03T12:45:00.000Z',
  })
  updatedAt!: string;
}
