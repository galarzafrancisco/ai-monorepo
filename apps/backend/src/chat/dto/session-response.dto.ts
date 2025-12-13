import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskResponseDto } from './task-response.dto';

export class ChatSessionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ADK session identifier',
    example: 'adk-session-123e4567-e89b-12d3-a456-426614174000',
  })
  adkSessionId!: string;

  @ApiProperty({
    description: 'ID of the agent for this chat session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  agentId!: string;

  @ApiProperty({
    description: 'Human-readable title for this session',
    example: 'Chat with Buddy - 2025-11-28',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional project label for this session',
    example: 'project:banana-mcp',
  })
  project!: string | null;

  @ApiProperty({
    description: 'Whether the session is archived',
    example: false,
  })
  isArchived!: boolean;

  @ApiProperty({
    description: 'Whether the session is pinned',
    example: false,
  })
  isPinned!: boolean;

  @ApiProperty({
    description: 'Timestamp of the last message in this chat',
    example: '2025-11-28T10:30:00.000Z',
  })
  lastMessageAt!: string;

  @ApiPropertyOptional({
    description: 'Tasks referenced in this session',
    type: [TaskResponseDto],
  })
  referencedTasks?: TaskResponseDto[];

  @ApiPropertyOptional({
    description: 'Tasks subscribed to in this session',
    type: [TaskResponseDto],
  })
  subscribedTasks?: TaskResponseDto[];

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2025-11-28T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Session last update timestamp',
    example: '2025-11-28T10:30:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Session deletion timestamp (soft delete)',
    example: null,
  })
  deletedAt!: string | null;
}
