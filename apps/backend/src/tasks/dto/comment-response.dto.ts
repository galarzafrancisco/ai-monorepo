import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { CommentEntity } from '../comment.entity';

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
    description: 'Display name of the commenter (for backward compatibility)',
    example: 'AgentAlpha',
  })
  commenterName!: string;

  @ApiPropertyOptional({
    description: 'Actor who created this comment',
    type: () => ActorResponseDto,
    nullable: true,
  })
  commenterActor!: ActorResponseDto | null;

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

  /**
   * Factory method to create a CommentResponseDto from a CommentEntity.
   * Used by the WebSocket gateway to map domain entities to wire DTOs.
   */
  static fromEntity(comment: CommentEntity): CommentResponseDto {
    return {
      id: comment.id,
      taskId: comment.taskId,
      commenterName: comment.commenterName,
      commenterActor: comment.commenterActor
        ? {
            id: comment.commenterActor.id,
            type: comment.commenterActor.type,
            slug: comment.commenterActor.slug,
            displayName: comment.commenterActor.displayName,
            avatarUrl: comment.commenterActor.avatarUrl,
            introduction: comment.commenterActor.introduction,
          }
        : null,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
