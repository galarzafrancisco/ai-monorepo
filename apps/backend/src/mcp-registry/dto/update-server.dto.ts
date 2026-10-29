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
import { MCP_SERVER_AUTH_TYPES, MCP_SERVER_TYPES } from '../mcp-server.types';
import type { McpServerAuthType, McpServerType } from '../mcp-server.types';

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
    description:
      'Who authorizes calls to the server. `taico`: Taico is the OAuth authorization server and workers send the agent\'s Taico execution token. `external`: the server handles its own auth and receives no Taico credentials. Servers with `requiresTaicoAuth` reject `external`.',
    enum: MCP_SERVER_AUTH_TYPES,
    required: false,
    example: 'external',
  })
  @IsOptional()
  @IsIn(MCP_SERVER_AUTH_TYPES)
  authType?: McpServerAuthType;

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
