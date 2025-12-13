import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({
    description: 'ID of the agent for this chat session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @ApiPropertyOptional({
    description: 'Human-readable title for this session',
    example: 'Banana MCP - design with Architect',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional project label for this session',
    example: 'project:banana-mcp',
  })
  @IsString()
  @IsOptional()
  project?: string;
}
