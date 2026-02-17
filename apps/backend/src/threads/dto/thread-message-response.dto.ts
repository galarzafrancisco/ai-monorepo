import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { ThreadMessageResult } from './service/threads.service.types';

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
    description: 'Actor who created the message',
    type: ActorResponseDto,
    nullable: true,
  })
  createdByActor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'When the message was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  static fromResult(result: ThreadMessageResult): ThreadMessageResponseDto {
    return {
      id: result.id,
      threadId: result.threadId,
      content: result.content,
      createdByActor: result.createdByActor
        ? ActorResponseDto.fromResult(result.createdByActor)
        : null,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
