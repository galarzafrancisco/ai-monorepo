import { ApiProperty } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { MetaTagResponseDto } from '../../meta/dto/tag-response.dto';
import { TaskSummaryResponseDto } from './task-summary-response.dto';
import { ContextBlockSummaryResponseDto } from './context-block-summary-response.dto';

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
}
