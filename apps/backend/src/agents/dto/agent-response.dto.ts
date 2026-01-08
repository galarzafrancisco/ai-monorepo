import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from 'src/taskeroo/enums';

export class AgentResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the agent',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Unique, human-readable identifier',
    example: 'buddy',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name for the agent',
    example: 'Buddy',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Short description of what this agent does',
    example: 'A helpful assistant agent',
  })
  description!: string | null;

  @ApiProperty({
    description: 'Core instructions/persona for this agent',
    example: 'You are a helpful assistant that helps users with tasks.',
  })
  systemPrompt!: string;

  // TODO: refine description and examples and types
  @ApiProperty({
    
    description: 'List of status that trigger this agent',
    example: ['NOT_STARTED', 'IN_PROGRESS'],
    type: [String],
  })
  statusTriggers!: TaskStatus[];

  @ApiProperty({
    description: 'List of tool identifiers this agent is allowed to use',
    example: ['taskeroo.createTask', 'taskeroo.readTask', 'wikiroo.search'],
    type: [String],
  })
  allowedTools!: string[];

  @ApiProperty({
    description: 'Whether this agent is available for assignment',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Max number of tasks this agent can process in parallel',
    example: 5,
  })
  concurrencyLimit!: number | null;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'Agent creation timestamp',
    example: '2025-11-28T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Agent last update timestamp',
    example: '2025-11-28T10:30:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Agent deletion timestamp (soft delete)',
    example: null,
  })
  deletedAt!: string | null;
}
