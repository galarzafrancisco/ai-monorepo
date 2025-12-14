import { ApiProperty } from '@nestjs/swagger';
import { AuthJourneyStatus } from '../enums/auth-journey-status.enum';
import { McpFlowResponseDto } from './mcp-flow-response.dto';
import { ConnectionFlowResponseDto } from './connection-flow-response.dto';

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
    description: 'The MCP authorization flow for this journey',
    type: McpFlowResponseDto,
  })
  mcpAuthorizationFlow!: McpFlowResponseDto;

  @ApiProperty({
    description: 'Connection authorization flows for this journey',
    type: [ConnectionFlowResponseDto],
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
