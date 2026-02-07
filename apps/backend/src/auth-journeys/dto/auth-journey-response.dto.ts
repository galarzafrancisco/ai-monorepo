import { ApiProperty } from '@nestjs/swagger';
import { AuthJourneyStatus } from '../enums/auth-journey-status.enum';
import { McpFlowResponseDto } from './mcp-flow-response.dto';
import { ConnectionFlowResponseDto } from './connection-flow-response.dto';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';

export class AuthJourneyResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the authorization journey',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Current status of the authorization journey',
    example: AuthJourneyStatus.MCP_AUTH_FLOW_STARTED,
    enum: AuthJourneyStatus,
  })
  status!: AuthJourneyStatus;

  @ApiProperty({
    description: 'The actor (user) associated with this authorization journey',
    type: ActorResponseDto,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'human',
      slug: 'jane@example.com',
      displayName: 'Jane Doe',
      avatarUrl: 'https://example.com/avatar.png',
      introduction: 'Security-focused product manager.',
    },
    nullable: true,
  })
  actor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'The MCP authorization flow for this journey',
    type: McpFlowResponseDto,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      authorizationJourneyId: '123e4567-e89b-12d3-a456-426614174000',
      serverId: '123e4567-e89b-12d3-a456-426614174000',
      clientId: '123e4567-e89b-12d3-a456-426614174000',
      clientName: 'My MCP Client',
      status: 'client_registered',
      scope: 'tool:read tool:execute',
      authorizationCodeExpiresAt: '2025-12-15T09:00:00.000Z',
      authorizationCodeUsed: false,
      createdAt: '2025-12-15T08:00:00.000Z',
      updatedAt: '2025-12-15T09:00:00.000Z',
    },
  })
  mcpAuthorizationFlow!: McpFlowResponseDto;

  @ApiProperty({
    description: 'Connection authorization flows for this journey',
    type: [ConnectionFlowResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        authorizationJourneyId: '123e4567-e89b-12d3-a456-426614174000',
        mcpConnectionId: '123e4567-e89b-12d3-a456-426614174000',
        connectionName: 'GitHub OAuth Connection',
        status: 'pending',
        tokenExpiresAt: '2025-12-15T10:00:00.000Z',
        createdAt: '2025-12-15T08:00:00.000Z',
        updatedAt: '2025-12-15T09:00:00.000Z',
      },
    ],
  })
  connectionAuthorizationFlows!: ConnectionFlowResponseDto[];

  @ApiProperty({
    description: 'Timestamp when the journey was created',
    example: '2025-12-15T08:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the journey was last updated',
    example: '2025-12-15T09:00:00.000Z',
  })
  updatedAt!: string;
}
