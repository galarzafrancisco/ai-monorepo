import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums';
import { CommentResponseDto } from './comment-response.dto';
import { ArtefactResponseDto } from './artefact-response.dto';
import { InputRequestResponseDto } from './input-request-response.dto';
import { TagResponseDto } from './tag-response.dto';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { TaskEntity } from '../task.entity';
import { ActorType } from '../../identity-provider/enums/actor-type.enum';
import { TaskResult } from './service/tasks.service.types';

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
    type: String,
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
    description: 'Artefacts associated with the task',
    type: () => [ArtefactResponseDto],
  })
  artefacts!: ArtefactResponseDto[];

  @ApiProperty({
    description: 'Input requests associated with the task',
    type: () => [InputRequestResponseDto],
  })
  inputRequests!: InputRequestResponseDto[];

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

  /**
   * Factory method to create a TaskResponseDto from a TaskEntity.
   * Used by the WebSocket gateway to map domain entities to wire DTOs.
   */
  static fromEntity(task: TaskEntity): TaskResponseDto {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
      assigneeActor: task.assigneeActor
        ? {
            id: task.assigneeActor.id,
            type: task.assigneeActor.type,
            slug: task.assigneeActor.slug,
            displayName: task.assigneeActor.displayName,
            avatarUrl: task.assigneeActor.avatarUrl,
            introduction: task.assigneeActor.introduction,
          }
        : null,
      sessionId: task.sessionId ?? '',
      comments: task.comments?.map((c) => CommentResponseDto.fromEntity(c)) ?? [],
      artefacts: task.artefacts?.map((a) => ArtefactResponseDto.fromEntity(a)) ?? [],
      inputRequests:
        task.inputRequests?.map((ir) =>
          InputRequestResponseDto.fromEntity(ir),
        ) ?? [],
      tags: task.tags?.map((t) => TagResponseDto.fromEntity(t)) ?? [],
      createdByActor: task.createdByActor
        ? {
            id: task.createdByActor.id,
            type: task.createdByActor.type,
            slug: task.createdByActor.slug,
            displayName: task.createdByActor.displayName,
            avatarUrl: task.createdByActor.avatarUrl,
            introduction: task.createdByActor.introduction,
          }
        : {
            id: task.createdByActorId,
            type: ActorType.AGENT,
            slug: 'unknown',
            displayName: 'Unknown',
            avatarUrl: null,
            introduction: null,
          },
      dependsOnIds: task.dependsOn?.map((t) => t.id) ?? [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * Factory method to create a TaskResponseDto from a TaskResult.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: TaskResult): TaskResponseDto {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      status: result.status,
      assignee: result.assignee,
      assigneeActor: result.assigneeActor
        ? ActorResponseDto.fromResult(result.assigneeActor)
        : null,
      sessionId: result.sessionId ?? '',
      comments: result.comments.map((c) => CommentResponseDto.fromResult(c)),
      artefacts: result.artefacts.map((a) => ArtefactResponseDto.fromResult(a)),
      inputRequests: result.inputRequests.map((ir) =>
        InputRequestResponseDto.fromResult(ir),
      ),
      tags: result.tags.map((t) => TagResponseDto.fromResult(t)),
      createdByActor: ActorResponseDto.fromResult(result.createdByActor),
      dependsOnIds: result.dependsOnIds,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
