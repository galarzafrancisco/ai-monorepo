import { ApiProperty } from '@nestjs/swagger';

export class ProtectedResourceMetadataResponseDto {
  @ApiProperty({
    description: 'Resource URL associated with the protected resource metadata',
    example: 'https://api.example.com',
  })
  resource!: string;

  @ApiProperty({
    description: 'Authorization servers that can be used to access this resource',
    example: ['https://auth.example.com/mcp/tasks/0.0.0'],
    type: [String],
  })
  authorization_servers!: string[];

  @ApiProperty({
    description: 'Scopes supported by this protected resource',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  scopes_supported!: string[];

  @ApiProperty({
    description: 'Bearer token transport methods supported by this resource',
    example: ['header'],
    type: [String],
  })
  bearer_methods_supported!: string[];

  @ApiProperty({
    description: 'Human-readable name of the resource',
    example: 'Tasks MCP API',
  })
  resource_name!: string;
}
