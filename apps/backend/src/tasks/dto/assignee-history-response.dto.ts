import { ApiProperty } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

export class AssigneeHistoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the history entry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Task ID this history entry belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId!: string;

  @ApiProperty({
    description: 'Actor ID of the assignee',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  assigneeActorId!: string;

  @ApiProperty({
    description: 'Actor who was assigned',
    type: () => ActorResponseDto,
  })
  assigneeActor!: ActorResponseDto;

  @ApiProperty({
    description: 'Timestamp when this assignment occurred',
    example: '2025-11-03T10:30:00.000Z',
  })
  assignedAt!: string;
}
