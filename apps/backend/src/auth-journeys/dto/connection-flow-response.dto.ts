import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectionFlowResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the connection authorization flow',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'UUID of the authorization journey this flow belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  authorizationJourneyId!: string;

  @ApiProperty({
    description: 'UUID of the MCP connection this flow uses',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  mcpConnectionId!: string;

  @ApiPropertyOptional({
    description: 'Connection friendly name',
    example: 'GitHub OAuth Connection',
    nullable: true,
    type: String,
  })
  connectionName?: string | null;

  @ApiProperty({
    description: 'Current status of the connection flow',
    example: 'pending',
    enum: ['pending', 'authorized', 'failed'],
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'When the access token expires',
    example: '2025-12-15T10:00:00.000Z',
    nullable: true,
    type: String,
  })
  tokenExpiresAt?: string | null;

  @ApiProperty({
    description: 'Timestamp when the flow was created',
    example: '2025-12-15T08:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the flow was last updated',
    example: '2025-12-15T09:00:00.000Z',
  })
  updatedAt!: string;
}
