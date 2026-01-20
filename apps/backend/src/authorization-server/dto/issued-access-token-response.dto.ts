import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for an issued access token (without the raw token value).
 * Used for listing tokens. Generic design - works for agents, services, etc.
 */
export class IssuedAccessTokenResponseDto {
  @ApiProperty({
    description: 'Unique identifier for this token',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable name for this token',
    example: 'Production API Token',
  })
  name!: string;

  @ApiProperty({
    description: 'Scopes granted to this token',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  scopes!: string[];

  @ApiProperty({
    description: 'Subject actor ID this token is issued for (JWT sub claim)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sub!: string;

  @ApiProperty({
    description: 'Subject actor slug',
    example: 'my-agent',
  })
  subjectSlug!: string;

  @ApiProperty({
    description: 'Subject actor display name',
    example: 'My Agent',
  })
  subjectDisplayName!: string;

  @ApiProperty({
    description: 'Actor ID of the issuer (human who created this token)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  issuedBy!: string;

  @ApiProperty({
    description: 'Display name of the issuer',
    example: 'John Doe',
  })
  issuedByDisplayName!: string;

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

  @ApiPropertyOptional({
    description: 'When this token was revoked (ISO 8601), null if active',
    example: null,
    type: String,
    nullable: true,
  })
  revokedAt!: string | null;

  @ApiPropertyOptional({
    description: 'When this token was last used (ISO 8601), null if never used',
    example: '2025-01-21T08:30:00.000Z',
    type: String,
    nullable: true,
  })
  lastUsedAt!: string | null;

  @ApiProperty({
    description: 'Whether the token is still valid (not expired and not revoked)',
    example: true,
  })
  isValid!: boolean;
}
