import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO representing a single scope with its ID and description.
 */
export class ScopeDto {
  @ApiProperty({
    description: 'The scope identifier string (e.g., "tasks:read")',
    example: 'tasks:read',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable description of what this scope grants',
    example: 'Allows users to read tasks, tags, comments, etc from Tasks.',
  })
  description!: string;
}

/**
 * Response DTO for the /scopes endpoint.
 */
export class ScopesResponseDto {
  @ApiProperty({
    description: 'List of all available scopes in the system',
    type: [ScopeDto],
  })
  scopes!: ScopeDto[];
}
