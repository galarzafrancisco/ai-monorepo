import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedEventType } from '../feed-item.entity';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

export class FeedItemResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the feed item',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Type of event that occurred',
    enum: FeedEventType,
    example: FeedEventType.TASK_CREATED,
  })
  eventType!: FeedEventType;

  @ApiProperty({
    description: 'ID of the task this event is related to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  taskId!: string;

  @ApiProperty({
    description: 'Name of the task this event is related to',
    example: 'Implement user authentication',
  })
  taskName!: string;

  @ApiProperty({
    description: 'Actor who triggered this event',
    type: () => ActorResponseDto,
  })
  actor!: ActorResponseDto;

  @ApiPropertyOptional({
    description: 'Additional metadata about the event',
    example: { oldStatus: 'NOT_STARTED', newStatus: 'IN_PROGRESS' },
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'When this event occurred',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;
}
