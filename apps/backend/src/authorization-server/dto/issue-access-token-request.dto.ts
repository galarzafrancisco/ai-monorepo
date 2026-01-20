import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';

/**
 * Request DTO for issuing a long-lived access token.
 * The subject (who the token is for) is determined by the endpoint context.
 */
export class IssueAccessTokenRequestDto {
  @ApiProperty({
    description: 'Human-readable name for this token (e.g., "CI/CD Pipeline Token")',
    example: 'Production API Token',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Scopes to grant to this token',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @ApiPropertyOptional({
    description: 'Number of days until token expires (default: 30, max: 365)',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expirationDays?: number;
}
