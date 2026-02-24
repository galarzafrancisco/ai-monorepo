import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
  IsIn,
  IsArray,
  IsNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { MCP_SERVER_TYPES } from '../mcp-server.types';
import type { McpServerType } from '../mcp-server.types';

export class UpdateServerDto {
  @ApiProperty({
    description: 'Transport type of the MCP server',
    enum: MCP_SERVER_TYPES,
    required: false,
    example: 'stdio',
  })
  @IsOptional()
  @IsIn(MCP_SERVER_TYPES)
  type?: McpServerType;

  @ApiProperty({
    description: 'Display name of the MCP server',
    example: 'GitHub Integration',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Short description of the MCP server',
    example: 'Provides access to GitHub repositories and issues',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL that MCP Clients will use to connect to the server',
    example: 'http://localhost:3000/api/v1/tasks/tasks/mcp',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url?: string;

  @ApiProperty({
    description: 'Command used to start a stdio MCP server',
    example: 'npx',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  cmd?: string;

  @ApiProperty({
    description: 'Arguments passed to the stdio command',
    example: ['@playwright/mcp@latest'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];
}
