import { ApiProperty } from '@nestjs/swagger';
import { MCP_SERVER_TYPES } from '../../mcp-registry/mcp-server.types';
import type {
  AgentToolPermissionRecord,
  AgentToolPermissionScopeRecord,
} from './service/agent-tool-permissions.service.types';

class AgentToolPermissionScopeResponseDto {
  @ApiProperty({
    description: 'Scope identifier',
    example: 'tasks:read',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable scope description',
    example: 'Read task details',
  })
  description!: string;

  static fromRecord(
    record: AgentToolPermissionScopeRecord,
  ): AgentToolPermissionScopeResponseDto {
    return {
      id: record.id,
      description: record.description,
    };
  }
}

class AgentToolPermissionServerResponseDto {
  @ApiProperty({
    description: 'MCP server UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'MCP server provided identifier',
    example: 'tasks',
  })
  providedId!: string;

  @ApiProperty({
    description: 'MCP server name',
    example: 'Tasks',
  })
  name!: string;

  @ApiProperty({
    description: 'MCP server description',
    example: 'Task operations exposed via MCP',
  })
  description!: string;

  @ApiProperty({
    description: 'MCP server transport type',
    enum: MCP_SERVER_TYPES,
    example: 'http',
  })
  type!: string;
}

export class AgentToolPermissionResponseDto {
  @ApiProperty({ type: AgentToolPermissionServerResponseDto })
  server!: AgentToolPermissionServerResponseDto;

  @ApiProperty({
    description: 'Subset of scopes granted to this agent for this server',
    type: [AgentToolPermissionScopeResponseDto],
  })
  grantedScopes!: AgentToolPermissionScopeResponseDto[];

  @ApiProperty({
    description:
      'True when this assignment grants every currently available scope on the server',
    example: false,
  })
  hasAllScopes!: boolean;

  static fromRecord(record: AgentToolPermissionRecord): AgentToolPermissionResponseDto {
    return {
      server: {
        id: record.serverId,
        providedId: record.serverProvidedId,
        name: record.serverName,
        description: record.serverDescription,
        type: record.serverType,
      },
      grantedScopes: record.grantedScopes.map((scope) =>
        AgentToolPermissionScopeResponseDto.fromRecord(scope),
      ),
      hasAllScopes: record.hasAllScopes,
    };
  }
}
