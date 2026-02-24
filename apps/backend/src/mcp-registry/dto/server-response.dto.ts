import { ApiProperty } from '@nestjs/swagger';
import { MCP_SERVER_TYPES } from '../mcp-server.types';
import type { McpServerType } from '../mcp-server.types';

export class ServerResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the MCP server',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable unique identifier for the MCP server',
    example: 'github-integration',
  })
  providedId!: string;

  @ApiProperty({
    description: 'Display name of the MCP server',
    example: 'GitHub Integration',
  })
  name!: string;

  @ApiProperty({
    description: 'Short description of the MCP server',
    example: 'Provides access to GitHub repositories and issues',
  })
  description!: string;

  @ApiProperty({
    description: 'Transport type of the MCP server',
    enum: MCP_SERVER_TYPES,
    example: 'http',
  })
  type!: McpServerType;

  @ApiProperty({
    description: 'URL that MCP Clients will use to connect to the server',
    example: 'http://localhost:3000/api/v1/tasks/tasks/mcp',
    required: false,
  })
  url?: string;

  @ApiProperty({
    description: 'Command used to start a stdio MCP server',
    example: 'npx',
    required: false,
  })
  cmd?: string;

  @ApiProperty({
    description: 'Arguments passed to the stdio command',
    example: ['@playwright/mcp@latest'],
    required: false,
    type: [String],
  })
  args?: string[];

  @ApiProperty({
    description: 'Timestamp when the server was created',
    example: '2025-11-05T08:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the server was last updated',
    example: '2025-11-05T08:00:00.000Z',
  })
  updatedAt!: string;
}
