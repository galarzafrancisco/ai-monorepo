import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from 'src/tasks/enums';
import { AgentType } from '../enums';

export class PatchAgentDto {
  @ApiPropertyOptional({
    description: 'Core instructions/persona for this agent',
    example: 'You are a helpful assistant that helps users with tasks.',
  })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Task statuses that will trigger this agent to activate',
    example: ['IN_PROGRESS', 'FOR_REVIEW'],
    type: [String],
    enum: TaskStatus,
  })
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @IsOptional()
  statusTriggers?: TaskStatus[];

  @ApiPropertyOptional({
    description: 'Type of agent (provider)',
    example: 'claude',
    enum: AgentType,
  })
  @IsEnum(AgentType)
  @IsOptional()
  type?: AgentType;
}
