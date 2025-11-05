import { ApiProperty } from '@nestjs/swagger';

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
