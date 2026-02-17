import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { ThreadMessageResult } from './service/threads.service.types';
import { ThreadMessageEntity } from '../thread-message.entity';

export class ThreadMessageResponseDto {
  @ApiProperty({
    description: 'Message ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Thread ID this message belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'What is the status of this feature?',
  })
  content!: string;

  @ApiPropertyOptional({
    description: 'Actor ID who created the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
    type: String,
  })
  createdByActorId!: string | null;

  @ApiPropertyOptional({
    description: 'Actor who created the message',
    type: () => ActorResponseDto,
    nullable: true,
  })
  createdByActor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'When the message was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'When the message was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: string;

  static fromResult(result: ThreadMessageResult): ThreadMessageResponseDto {
    return {
      id: result.id,
      threadId: result.threadId,
      content: result.content,
      createdByActorId: result.createdByActorId || null,
      createdByActor: result.createdByActor
        ? ActorResponseDto.fromResult(result.createdByActor)
        : null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.createdAt.toISOString(), // No updatedAt in entity yet
    };
  }

  static fromEntity(entity: ThreadMessageEntity): ThreadMessageResponseDto {
    return {
      id: entity.id,
      threadId: entity.threadId,
      content: entity.content,
      createdByActorId: entity.createdByActorId || null,
      createdByActor: entity.createdByActor
        ? ActorResponseDto.fromEntity(entity.createdByActor)
        : null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.createdAt.toISOString(), // No updatedAt in entity yet
    };
  }
}
