import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../enums';

export class CreateAgentDto {
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
    example: 'claude',
    enum: AgentType,
    default: AgentType.CLAUDE,
  })
  @IsEnum(AgentType)
  @IsOptional()
  type?: AgentType;

  @ApiPropertyOptional({
    description: 'Short description of what this agent does',
    example: 'A helpful assistant agent',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Introduction field for semantic matching - describes what this agent is good at and when to assign them tasks',
    example: 'I specialize in code review and bug fixing. Assign me tasks related to quality assurance.',
  })
  @IsString()
  @IsOptional()
  introduction?: string;

  @ApiProperty({
    description: 'Core instructions/persona for this agent',
    example: 'You are a helpful assistant that helps users with tasks.',
  })
  @IsString()
  systemPrompt!: string;

  // TODO: refine description and examples and types
  @ApiPropertyOptional({
    description: 'Task statuses that will trigger this agent to activate',
    example: ['IN_PROGRESS', 'FOR_REVIEW'],
    type: [String],
    enum: TaskStatus,
    default: [],
  })
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @IsOptional()
  statusTriggers?: TaskStatus[];

  @ApiPropertyOptional({
    description: 'List of tool identifiers this agent is allowed to use',
    example: ['tasks.createTask', 'tasks.readTask', 'context.search'],
    type: [String],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedTools?: string[];

  @ApiPropertyOptional({
    description: 'Whether this agent is available for assignment',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Max number of tasks this agent can process in parallel',
    example: 5,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  concurrencyLimit?: number;
}
