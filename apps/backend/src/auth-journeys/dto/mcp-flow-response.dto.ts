import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { McpAuthorizationFlowStatus } from '../enums/mcp-authorization-flow-status.enum';

export class McpFlowResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the MCP authorization flow',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'UUID of the authorization journey this flow belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  authorizationJourneyId!: string;

  @ApiProperty({
    description: 'UUID of the MCP server',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serverId!: string;

  @ApiProperty({
    description: 'UUID of the registered MCP client',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clientId!: string;

  @ApiPropertyOptional({
    description: 'Client name for display',
    example: 'My MCP Client',
    nullable: true,
    type: String,
  })
  clientName?: string | null;

  @ApiProperty({
    description: 'Current status of the MCP authorization flow',
    example: McpAuthorizationFlowStatus.CLIENT_REGISTERED,
    enum: McpAuthorizationFlowStatus,
  })
  status!: McpAuthorizationFlowStatus;

  @ApiPropertyOptional({
    description: 'Scopes requested by the client',
    example: 'tool:read tool:execute',
    nullable: true,
    type: String,
  })
  scope?: string | null;

  @ApiPropertyOptional({
    description: 'When the authorization code expires',
    example: '2025-12-15T09:00:00.000Z',
    nullable: true,
    type: String,
  })
  authorizationCodeExpiresAt?: string | null;

  @ApiProperty({
    description: 'Whether the authorization code has been used',
    example: false,
  })
  authorizationCodeUsed!: boolean;

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
