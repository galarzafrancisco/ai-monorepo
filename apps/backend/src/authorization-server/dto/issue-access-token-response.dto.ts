import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for a newly issued access token.
 * The raw token is only returned once and should be stored securely by the client.
 */
export class IssueAccessTokenResponseDto {
  @ApiProperty({
    description: 'Unique identifier for this token (can be used for revocation)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable name for this token',
    example: 'Production API Token',
  })
  name!: string;

  @ApiProperty({
    description: 'The raw JWT token - only shown once, store securely!',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;

  @ApiProperty({
    description: 'Scopes granted to this token',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  scopes!: string[];

  @ApiProperty({
    description: 'When this token expires (ISO 8601)',
    example: '2025-02-20T12:00:00.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'When this token was created (ISO 8601)',
    example: '2025-01-20T12:00:00.000Z',
  })
  createdAt!: string;
}
