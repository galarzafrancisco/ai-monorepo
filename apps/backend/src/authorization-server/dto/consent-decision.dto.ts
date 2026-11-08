import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * User consent decision DTO for authorization flow
 */
export class ConsentDecisionDto {
  @ApiProperty({
    description: 'Authorization flow ID (serves as CSRF protection token)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  flow_id!: string;

  @ApiProperty({
    description: 'Whether the user approved the authorization request',
    example: true,
  })
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({
    description:
      "The workspace the consent screen showed. For Taico's own servers, approval is refused if the session has since switched to another workspace.",
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  workspace_id?: string;
}
