import { ApiProperty } from '@nestjs/swagger';

export class ScopeResponseDto {
  @ApiProperty({
    description: 'Unique scope identifier (e.g., tool:read)',
    example: 'tool:read',
  })
  scopeId!: string;

  @ApiProperty({
    description: 'Description of what this scope allows',
    example: 'Read access to tools',
  })
  description!: string;

  @ApiProperty({
    description: 'UUID of the MCP server this scope belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serverId!: string;

  @ApiProperty({
    description: 'Timestamp when the scope was created',
    example: '2025-11-05T08:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the scope was last updated',
    example: '2025-11-05T08:00:00.000Z',
  })
  updatedAt!: string;
}
