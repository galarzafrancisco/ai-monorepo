import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums';
import { CommentResponseDto } from './comment-response.dto';
import { TagResponseDto } from './tag-response.dto';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

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
    description: 'Slug of the assignee (for backward compatibility)',
    example: 'agent-alpha',
    nullable: true,
  })
  assignee!: string | null;

  @ApiPropertyOptional({
    description: 'Actor assigned to this task',
    type: () => ActorResponseDto,
    nullable: true,
  })
  assigneeActor!: ActorResponseDto | null;

  @ApiPropertyOptional({
    description: 'Session ID for tracking AI agent work',
    example: 'session-123-abc',
    nullable: true,
  })
  sessionId!: string;

  @ApiProperty({
    description: 'Comments associated with the task',
    type: () => [CommentResponseDto],
  })
  comments!: CommentResponseDto[];

  @ApiProperty({
    description: 'Tags associated with the task',
    type: () => [TagResponseDto],
  })
  tags!: TagResponseDto[];

  @ApiProperty({
    description: 'Actor who created this task',
    type: () => ActorResponseDto,
  })
  createdByActor!: ActorResponseDto;

  @ApiProperty({
    description: 'Array of task IDs that this task depends on',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  dependsOnIds!: string[];

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
