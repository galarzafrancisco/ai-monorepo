import { ApiProperty } from '@nestjs/swagger';

export class MappingResponseDto {
  @ApiProperty({
    description: 'System-generated UUID for the mapping',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'MCP scope identifier',
    example: 'tool:read',
  })
  mcpScopeId!: string;

  @ApiProperty({
    description: 'UUID of the MCP server',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serverId!: string;

  @ApiProperty({
    description: 'UUID of the downstream OAuth connection',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  connectionId!: string;

  @ApiProperty({
    description: 'Downstream provider scope string',
    example: 'repo:read',
  })
  downstreamScope!: string;

  @ApiProperty({
    description: 'Timestamp when the mapping was created',
    example: '2025-11-05T08:00:00.000Z',
  })
  createdAt!: string;
}
