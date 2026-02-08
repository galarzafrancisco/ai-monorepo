import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../enums';
import { AgentResult } from './service/agents.service.types';

export class AgentResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the actor representing this agent',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  actorId!: string;

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

  @ApiProperty({
    description: 'Type of agent (provider)',
    example: 'claude',
    enum: AgentType,
  })
  type!: AgentType;

  @ApiPropertyOptional({
    description: 'Short description of what this agent does',
    example: 'A helpful assistant agent',
  })
  description!: string | null;

  @ApiPropertyOptional({
    description:
      'Introduction field for semantic matching - describes what this agent is good at and when to assign them tasks',
    example: 'I specialize in code review and bug fixing. Assign me tasks related to quality assurance.',
  })
  introduction!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional avatar URL for the agent actor',
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Core instructions/persona for this agent',
    example: 'You are a helpful assistant that helps users with tasks.',
  })
  systemPrompt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Provider ID to select a model runtime',
    example: 'openai',
  })
  providerId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Model ID used by the agent runtime',
    example: 'gpt-5.2-codex',
  })
  modelId!: string | null;

  @ApiProperty({
    description: 'Task statuses that trigger this agent to activate',
    example: [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS],
    enum: TaskStatus,
    isArray: true,
  })
  statusTriggers!: TaskStatus[];

  @ApiProperty({
    description: 'Task tags that trigger this agent to activate',
    example: ['code', 'review'],
    type: String,
    isArray: true,
  })
  tagTriggers!: string[];

  @ApiProperty({
    description: 'List of MCP tool identifiers this agent is allowed to use',
    example: ['tasks.createTask', 'tasks.readTask', 'context.search'],
    type: String,
    isArray: true,
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

  /**
   * Factory method to create an AgentResponseDto from an AgentResult.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: AgentResult): AgentResponseDto {
    return {
      actorId: result.actorId,
      slug: result.slug,
      name: result.name,
      type: result.type,
      description: result.description,
      introduction: result.introduction,
      avatarUrl: result.avatarUrl,
      systemPrompt: result.systemPrompt,
      providerId: result.providerId,
      modelId: result.modelId,
      statusTriggers: result.statusTriggers,
      tagTriggers: result.tagTriggers,
      allowedTools: result.allowedTools,
      isActive: result.isActive,
      concurrencyLimit: result.concurrencyLimit,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      deletedAt: result.deletedAt ? result.deletedAt.toISOString() : null,
    };
  }
}
