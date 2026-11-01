import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../enums';
import {
  AGENT_DEFINITION_VERSION,
  AgentDefinitionsDocument,
  AgentDefinition,
  ImportAgentIssue,
  ImportAgentsResult,
} from './service/agent-import-export.service.types';

export class AgentToolPermissionDefinitionDto {
  @ApiProperty({
    description:
      'Portable MCP server identifier. Database server IDs are not accepted.',
    example: 'tasks',
  })
  @IsString()
  @IsNotEmpty()
  serverProvidedId!: string;

  @ApiProperty({
    description: 'Scope identifiers granted on that server',
    type: [String],
    example: ['tasks:read'],
  })
  @IsArray()
  @IsString({ each: true })
  scopeIds!: string[];
}

export class AgentDefinitionDto {
  @ApiProperty({
    description: 'Unique, human-readable identifier for the agent',
    example: 'buddy',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({
    description: 'Display name for the agent',
    example: 'Buddy',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Type of agent (provider)',
    enum: AgentType,
    example: AgentType.CLAUDE,
  })
  @IsEnum(AgentType)
  @IsOptional()
  type?: AgentType;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Short description of what this agent does',
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Introduction used for semantic matching',
  })
  @IsString()
  @IsOptional()
  introduction?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Managed avatar URL. External URLs are rejected on import.',
    example: '/avatar/claude.webp',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string | null;

  @ApiProperty({
    description: 'Core instructions for this agent',
    example: 'You are a helpful assistant.',
  })
  @IsString()
  systemPrompt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Prompt sent on the same session after the agent finishes its turn',
  })
  @IsString()
  @IsOptional()
  followUpPrompt?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Provider ID used to select a model runtime',
    example: 'openai',
  })
  @IsString()
  @IsOptional()
  providerId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Model ID used by the agent runtime',
    example: 'gpt-5.4',
  })
  @IsString()
  @IsOptional()
  modelId?: string | null;

  @ApiPropertyOptional({
    description: 'Task statuses that trigger this agent',
    enum: TaskStatus,
    isArray: true,
  })
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @IsOptional()
  statusTriggers?: TaskStatus[];

  @ApiPropertyOptional({
    description: 'Task tag names that trigger this agent',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagTriggers?: string[];

  @ApiPropertyOptional({
    description: 'Tool identifiers this agent is allowed to use',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedTools?: string[];

  @ApiPropertyOptional({
    description: 'Whether this agent is available for assignment',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Max number of tasks this agent can process in parallel',
    example: 5,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  concurrencyLimit?: number | null;

  @ApiPropertyOptional({
    description:
      'Stored tool grants, keyed by MCP server providedId. Omitted means leave existing grants unchanged.',
    type: [AgentToolPermissionDefinitionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentToolPermissionDefinitionDto)
  @IsOptional()
  toolPermissions?: AgentToolPermissionDefinitionDto[];

  static fromDefinition(definition: AgentDefinition): AgentDefinitionDto {
    return {
      slug: definition.slug,
      name: definition.name,
      type: definition.type,
      description: definition.description,
      introduction: definition.introduction,
      avatarUrl: definition.avatarUrl,
      systemPrompt: definition.systemPrompt,
      followUpPrompt: definition.followUpPrompt,
      providerId: definition.providerId,
      modelId: definition.modelId,
      statusTriggers: definition.statusTriggers,
      tagTriggers: definition.tagTriggers,
      allowedTools: definition.allowedTools,
      isActive: definition.isActive,
      concurrencyLimit: definition.concurrencyLimit,
      toolPermissions: definition.toolPermissions,
    };
  }
}

export class AgentDefinitionsDocumentDto {
  @ApiProperty({
    description: 'Portable agent definition document version',
    example: AGENT_DEFINITION_VERSION,
  })
  @IsInt()
  @Equals(AGENT_DEFINITION_VERSION)
  version!: number;

  @ApiProperty({
    description: 'Agent definitions to export or import',
    type: [AgentDefinitionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentDefinitionDto)
  agents!: AgentDefinitionDto[];

  static fromDocument(
    document: AgentDefinitionsDocument,
  ): AgentDefinitionsDocumentDto {
    return {
      version: document.version,
      agents: document.agents.map((agent) =>
        AgentDefinitionDto.fromDefinition(agent),
      ),
    };
  }
}

export class ImportAgentIssueDto {
  @ApiProperty({
    description: 'Agent slug the issue applies to',
    example: 'buddy',
  })
  slug!: string;

  @ApiProperty({
    description: 'Why the agent failed or was only partially applied',
    example: 'An agent with this slug already exists.',
  })
  reason!: string;

  static fromIssue(issue: ImportAgentIssue): ImportAgentIssueDto {
    return {
      slug: issue.slug,
      reason: issue.reason,
    };
  }
}

export class ImportAgentsResponseDto {
  @ApiProperty({
    description: 'Slugs created by this import',
    type: [String],
  })
  created!: string[];

  @ApiProperty({
    description: 'Slugs updated by this import',
    type: [String],
  })
  updated!: string[];

  @ApiProperty({
    description: 'Agents that were not created or updated',
    type: [ImportAgentIssueDto],
  })
  failed!: ImportAgentIssueDto[];

  @ApiProperty({
    description:
      'Agents that were created or updated, but with a related record skipped',
    type: [ImportAgentIssueDto],
  })
  warnings!: ImportAgentIssueDto[];

  static fromResult(result: ImportAgentsResult): ImportAgentsResponseDto {
    return {
      created: result.created,
      updated: result.updated,
      failed: result.failed.map((issue) => ImportAgentIssueDto.fromIssue(issue)),
      warnings: result.warnings.map((issue) =>
        ImportAgentIssueDto.fromIssue(issue),
      ),
    };
  }
}
