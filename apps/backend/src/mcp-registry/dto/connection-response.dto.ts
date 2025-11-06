import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectionResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the connection',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'UUID of the MCP server this connection belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serverId!: string;

  @ApiProperty({
    description: 'Friendly name for operators to distinguish connections',
    example: 'Production GitHub OAuth',
  })
  friendlyName!: string;

  @ApiProperty({
    description: 'OAuth client ID',
    example: 'client_abc123',
  })
  clientId!: string;

  @ApiPropertyOptional({
    description: 'OAuth client secret (masked for security)',
    example: null,
    nullable: true,
    type: 'string',
  })
  clientSecret!: string | null;

  @ApiProperty({
    description: 'OAuth authorization URL',
    example: 'https://github.com/login/oauth/authorize',
  })
  authorizeUrl!: string;

  @ApiProperty({
    description: 'OAuth token URL',
    example: 'https://github.com/login/oauth/access_token',
  })
  tokenUrl!: string;

  @ApiProperty({
    description: 'Timestamp when the connection was created',
    example: '2025-11-05T08:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the connection was last updated',
    example: '2025-11-05T08:00:00.000Z',
  })
  updatedAt!: string;
}
