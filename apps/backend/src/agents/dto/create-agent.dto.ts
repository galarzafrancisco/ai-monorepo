import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
