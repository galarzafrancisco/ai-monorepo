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
import { TaskStatus } from 'src/taskeroo/enums';

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
    description: 'Short description of what this agent does',
    example: 'A helpful assistant agent',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Core instructions/persona for this agent',
    example: 'You are a helpful assistant that helps users with tasks.',
  })
  @IsString()
  @IsNotEmpty()
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

  @ApiProperty({
    description: 'List of tool identifiers this agent is allowed to use',
    example: ['taskeroo.createTask', 'taskeroo.readTask', 'wikiroo.search'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  allowedTools!: string[];

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
