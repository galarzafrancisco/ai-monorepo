import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InputRequestEntity } from '../input-request.entity';
import { InputRequestResult } from './service/tasks.service.types';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

export class InputRequestResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the input request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the task this input request belongs to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  taskId!: string;

  @ApiProperty({
    description: 'ID of the actor who asked the question',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  askedByActorId!: string;

  @ApiProperty({
    description: 'ID of the actor assigned to answer the question',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  assignedToActorId!: string;

  @ApiPropertyOptional({
    description: 'Actor who asked the question, including deactivated personas',
    type: () => ActorResponseDto,
    nullable: true,
  })
  askedByActor!: ActorResponseDto | null;

  @ApiPropertyOptional({
    description: 'Actor assigned to answer, including deactivated personas',
    type: () => ActorResponseDto,
    nullable: true,
  })
  assignedToActor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'The question being asked',
    example: 'Should we use OAuth or JWT for authentication?',
  })
  question!: string;

  @ApiPropertyOptional({
    description: 'The answer to the question',
    example: 'Use JWT with refresh tokens',
    nullable: true,
  })
  answer!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the question was resolved',
    example: '2025-11-03T12:45:00.000Z',
    nullable: true,
  })
  resolvedAt!: string | null;

  @ApiProperty({
    description: 'Input request creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Input request last update timestamp',
    example: '2025-11-03T12:45:00.000Z',
  })
  updatedAt!: string;

  /**
   * Factory method to create an InputRequestResponseDto from an InputRequestEntity.
   * Used by the WebSocket gateway to map domain entities to wire DTOs.
   */
  static fromEntity(
    inputRequest: InputRequestEntity,
  ): InputRequestResponseDto {
    return {
      id: inputRequest.id,
      taskId: inputRequest.taskId,
      askedByActorId: inputRequest.askedByActorId,
      assignedToActorId: inputRequest.assignedToActorId,
      askedByActor: inputRequest.askedByActor
        ? ActorResponseDto.fromEntity(inputRequest.askedByActor)
        : null,
      assignedToActor: inputRequest.assignedToActor
        ? ActorResponseDto.fromEntity(inputRequest.assignedToActor)
        : null,
      question: inputRequest.question,
      answer: inputRequest.answer,
      resolvedAt: inputRequest.resolvedAt
        ? inputRequest.resolvedAt.toISOString()
        : null,
      createdAt: inputRequest.createdAt.toISOString(),
      updatedAt: inputRequest.updatedAt.toISOString(),
    };
  }

  /**
   * Factory method to create an InputRequestResponseDto from an InputRequestResult.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: InputRequestResult): InputRequestResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      askedByActorId: result.askedByActorId,
      assignedToActorId: result.assignedToActorId,
      askedByActor: result.askedByActor
        ? ActorResponseDto.fromResult(result.askedByActor)
        : null,
      assignedToActor: result.assignedToActor
        ? ActorResponseDto.fromResult(result.assignedToActor)
        : null,
      question: result.question,
      answer: result.answer,
      resolvedAt: result.resolvedAt ? result.resolvedAt.toISOString() : null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
