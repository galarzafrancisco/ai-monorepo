import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUrl,
  IsIn,
  IsArray,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { MCP_SERVER_TYPES } from '../mcp-server.types';
import type { McpServerType } from '../mcp-server.types';

export class CreateServerDto {
  @ApiProperty({
    description: 'Human-readable unique identifier for the MCP server',
    example: 'github-integration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  providedId!: string;

  @ApiProperty({
    description: 'Display name of the MCP server',
    example: 'GitHub Integration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Short description of the MCP server',
    example: 'Provides access to GitHub repositories and issues',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'Transport type of the MCP server',
    enum: MCP_SERVER_TYPES,
    example: 'http',
  })
  @IsIn(MCP_SERVER_TYPES)
  type!: McpServerType;

  @ApiProperty({
    description: 'URL that MCP Clients will use to connect to the server',
    example: 'http://localhost:3000/api/v1/tasks/tasks/mcp',
    required: false,
  })
  @ValidateIf((o: CreateServerDto) => o.type === 'http' || o.url !== undefined)
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url?: string;

  @ApiProperty({
    description: 'Command used to start a stdio MCP server',
    example: 'npx',
    required: false,
  })
  @ValidateIf((o: CreateServerDto) => o.type === 'stdio' || o.cmd !== undefined)
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
  @ValidateIf((o: CreateServerDto) => o.type === 'stdio' || o.args !== undefined)
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];
}
