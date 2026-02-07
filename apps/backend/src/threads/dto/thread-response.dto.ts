import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { MetaTagResponseDto } from '../../meta/dto/tag-response.dto';
import { TaskSummaryResponseDto } from './task-summary-response.dto';
import { ContextBlockSummaryResponseDto } from './context-block-summary-response.dto';
import { ThreadResult } from './service/threads.service.types';

export class ThreadResponseDto {
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
    description: 'Actor who created the thread',
    type: ActorResponseDto,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'human',
      slug: 'jane@example.com',
      displayName: 'Jane Doe',
      avatarUrl: 'https://example.com/avatar.png',
      introduction: 'Product lead.',
    },
  })
  createdByActor!: ActorResponseDto;

  @ApiPropertyOptional({
    description: 'Parent task ID that created the thread',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    nullable: true,
  })
  parentTaskId!: string | null;

  @ApiProperty({
    description: 'Tasks attached to this thread',
    type: [TaskSummaryResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Implement user authentication',
        description: 'Add JWT-based authentication to the API',
        status: 'IN_PROGRESS',
        assigneeActor: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'agent',
          slug: 'agent-alpha',
          displayName: 'Agent Alpha',
          avatarUrl: 'https://example.com/avatar.png',
          introduction: 'Task execution agent.',
        },
        createdByActor: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'human',
          slug: 'jane@example.com',
          displayName: 'Jane Doe',
          avatarUrl: 'https://example.com/avatar.png',
          introduction: 'Product lead.',
        },
        tags: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'bug',
            color: '#FF5733',
          },
        ],
        commentCount: 2,
        inputRequests: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            taskId: '123e4567-e89b-12d3-a456-426614174001',
            askedByActorId: '123e4567-e89b-12d3-a456-426614174002',
            assignedToActorId: '123e4567-e89b-12d3-a456-426614174003',
            question: 'Should we use OAuth or JWT for authentication?',
            answer: 'Use JWT with refresh tokens',
            resolvedAt: '2025-11-03T12:45:00.000Z',
            createdAt: '2025-11-03T10:30:00.000Z',
            updatedAt: '2025-11-03T12:45:00.000Z',
          },
        ],
        updatedAt: '2024-01-15T10:30:00Z',
      },
    ],
  })
  tasks!: TaskSummaryResponseDto[];

  @ApiProperty({
    description: 'Context blocks referenced in this thread',
    type: [ContextBlockSummaryResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'API Design Documentation',
      },
    ],
  })
  referencedContextBlocks!: ContextBlockSummaryResponseDto[];

  @ApiProperty({
    description: 'Tags associated with this thread',
    type: [MetaTagResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'bug',
        color: '#FF5733',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
    ],
  })
  tags!: MetaTagResponseDto[];

  @ApiProperty({
    description: 'Participants in this thread',
    type: [ActorResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'human',
        slug: 'jane@example.com',
        displayName: 'Jane Doe',
        avatarUrl: 'https://example.com/avatar.png',
        introduction: 'Product lead.',
      },
    ],
  })
  participants!: ActorResponseDto[];

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'When the thread was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'When the thread was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: string;

  /**
   * Factory method to create a ThreadResponseDto from a ThreadResult.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: ThreadResult): ThreadResponseDto {
    return {
      id: result.id,
      title: result.title,
      createdByActor: ActorResponseDto.fromResult(result.createdByActor),
      parentTaskId: result.parentTaskId,
      tasks: result.tasks.map((t) => TaskSummaryResponseDto.fromResult(t)),
      referencedContextBlocks: result.referencedContextBlocks.map((b) =>
        ContextBlockSummaryResponseDto.fromResult(b),
      ),
      tags: result.tags.map((t) => MetaTagResponseDto.fromResult(t)),
      participants: result.participants.map((p) =>
        ActorResponseDto.fromResult(p),
      ),
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
