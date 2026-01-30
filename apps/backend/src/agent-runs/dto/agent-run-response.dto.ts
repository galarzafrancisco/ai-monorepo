import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

class TaskInfoDto {
  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Task name',
    example: 'Implement authentication',
  })
  name!: string;
}

export class AgentRunResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the agent run',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'UUID of the actor (agent) running',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  actorId!: string;

  @ApiPropertyOptional({
    description: 'Actor information',
    type: () => ActorResponseDto,
    nullable: true,
  })
  actor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'UUID of the parent task being executed',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  parentTaskId!: string;

  @ApiPropertyOptional({
    description: 'Parent task information',
    type: () => TaskInfoDto,
    nullable: true,
  })
  parentTask!: TaskInfoDto | null;

  @ApiProperty({
    description: 'Run creation timestamp',
    example: '2026-01-30T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the run started',
    example: '2026-01-30T10:30:00.000Z',
    nullable: true,
  })
  startedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the run ended',
    example: '2026-01-30T10:45:00.000Z',
    nullable: true,
  })
  endedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp of the last ping/heartbeat',
    example: '2026-01-30T10:40:00.000Z',
    nullable: true,
  })
  lastPing!: string | null;
}
