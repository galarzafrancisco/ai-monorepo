import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';

/**
 * DTO for server information in the flow response.
 */
export class FlowServerDto {
  @ApiProperty({
    description: 'Server identifier used in API paths',
    example: 'tasks',
  })
  providedId!: string;

  @ApiProperty({
    description: 'Human-readable name of the MCP server',
    example: 'Tasks',
  })
  name!: string;

  @ApiProperty({
    description: 'Description of what the MCP server does',
    example: 'Task management and productivity tool',
  })
  description!: string;
}

/**
 * DTO for client information in the flow response.
 */
export class FlowClientDto {
  @ApiProperty({
    description: 'OAuth client identifier',
    example: '0bab273987a2e163c3abb40c631ec0a4',
  })
  clientId!: string;

  @ApiProperty({
    description: 'Human-readable name of the client application',
    example: 'Claude Desktop',
  })
  clientName!: string;
}

/**
 * DTO for authorization flow details returned to the consent screen.
 * Exposes only the information needed for user consent, excluding sensitive data
 * like PKCE parameters and authorization codes.
 * Maps 1:1 to ConsentMetadata
 */
export class GetConsentMetadataResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the authorization flow',
    example: 'b15e8a76-5b6d-4bde-9a3b-26fdbaab5b4c',
  })
  id!: string;

  @ApiProperty({
    description: 'Current status of the authorization flow',
    enum: McpAuthorizationFlowStatus,
    example: McpAuthorizationFlowStatus.AUTHORIZATION_REQUEST_STARTED,
  })
  status!: McpAuthorizationFlowStatus;

  @ApiPropertyOptional({
    description: 'List of scopes being requested',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  scopes?: string[];

  @ApiPropertyOptional({
    description: 'Resource URL the client wants to access',
    example: 'http://localhost:4001/',
  })
  resource?: string;

  @ApiProperty({
    description: 'MCP server the client is requesting access to',
    type: FlowServerDto,
  })
  server!: FlowServerDto;

  @ApiProperty({
    description: 'Client application requesting authorization',
    type: FlowClientDto,
  })
  client!: FlowClientDto;

  @ApiProperty({
    description: 'Redirect URI provided in the authorization request',
    example: 'http://localhost:4001/callback',
  })
  redirectUri!: string;

  @ApiProperty({
    description: 'Timestamp when the flow was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;
}
