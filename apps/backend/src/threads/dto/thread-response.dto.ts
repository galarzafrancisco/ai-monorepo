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
  })
  createdByActor!: ActorResponseDto;

  @ApiProperty({
    description: 'Parent task ID that this thread belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  parentTaskId!: string;

  @ApiProperty({
    description: 'State context block ID that tracks the evolving state of this thread',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  stateContextBlockId!: string;

  @ApiProperty({
    description: 'Tasks attached to this thread',
    type: [TaskSummaryResponseDto],
  })
  tasks!: TaskSummaryResponseDto[];

  @ApiProperty({
    description: 'Context blocks referenced in this thread',
    type: [ContextBlockSummaryResponseDto],
  })
  referencedContextBlocks!: ContextBlockSummaryResponseDto[];

  @ApiProperty({
    description: 'Tags associated with this thread',
    type: [MetaTagResponseDto],
  })
  tags!: MetaTagResponseDto[];

  @ApiProperty({
    description: 'Participants in this thread',
    type: [ActorResponseDto],
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
      stateContextBlockId: result.stateContextBlockId,
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
