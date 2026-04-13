import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../enums';

export class AgentTemplateModelOptionDto {
  @ApiProperty({
    description: 'Stable option identifier used by the UI.',
    example: 'openai:gpt-5.3-codex',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable model option label.',
    example: 'GPT-5.3 Codex',
  })
  label!: string;

  @ApiPropertyOptional({
    description: 'Provider ID submitted when this option is selected.',
    example: 'openai',
  })
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Model ID submitted when this option is selected.',
    example: 'gpt-5.3-codex',
  })
  modelId?: string;

  @ApiProperty({
    description: 'Whether this represents the runtime default model.',
    example: false,
  })
  isDefault!: boolean;
}

export class AgentTemplateHarnessDto {
  @ApiProperty({
    enum: AgentType,
    description: 'Agent harness type.',
    example: AgentType.CLAUDE,
  })
  type!: AgentType;

  @ApiProperty({
    description: 'Human-readable harness name.',
    example: 'Claude Code',
  })
  label!: string;

  @ApiProperty({
    description: 'Short explanation of when to use this harness.',
    example: 'Run tasks through the Claude Code harness.',
  })
  description!: string;

  @ApiProperty({ type: [AgentTemplateModelOptionDto] })
  modelOptions!: AgentTemplateModelOptionDto[];
}

export class AgentTemplateDto {
  @ApiProperty({
    description: 'Stable template identifier.',
    example: 'developer',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable template name.',
    example: 'Developer',
  })
  label!: string;

  @ApiProperty({
    description: 'Short explanation of what this template configures.',
    example: 'Picks up queued implementation tasks and brings them to review.',
  })
  description!: string;

  @ApiPropertyOptional({
    enum: AgentType,
    description: 'Default harness type for this template.',
    example: AgentType.OPENCODE,
  })
  type?: AgentType;

  @ApiPropertyOptional({
    description: 'Default provider ID for this template.',
    example: 'openai',
  })
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Default model ID for this template.',
    example: 'gpt-5.3-codex',
  })
  modelId?: string;

  @ApiProperty({
    description: 'Default system prompt for this template.',
  })
  systemPrompt!: string;

  @ApiPropertyOptional({
    description: 'Default agent description.',
  })
  agentDescription?: string;

  @ApiProperty({
    description: 'Default statuses that trigger the agent.',
    enum: TaskStatus,
    isArray: true,
  })
  statusTriggers!: TaskStatus[];

  @ApiProperty({
    description: 'Default tag names that filter agent triggers.',
    type: String,
    isArray: true,
  })
  tagTriggers!: string[];

  @ApiPropertyOptional({
    description: 'Default avatar URL for this template.',
    example: '/icons/cockatoo.png',
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Default concurrency limit for this template.',
    example: 1,
  })
  concurrencyLimit?: number;
}

export class AgentTemplateCatalogResponseDto {
  @ApiProperty({ type: [AgentTemplateDto] })
  templates!: AgentTemplateDto[];

  @ApiProperty({ type: [AgentTemplateHarnessDto] })
  harnesses!: AgentTemplateHarnessDto[];
}
