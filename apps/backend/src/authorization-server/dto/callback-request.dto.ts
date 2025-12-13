import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CallbackRequestDto {
  @ApiProperty({
    description: 'Authorization code from downstream OAuth provider',
    example: 'abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'State parameter that identifies the connection flow',
    example: 'xyz789abc',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiPropertyOptional({
    description: 'Error code if authorization failed',
    example: 'access_denied',
  })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiPropertyOptional({
    description: 'Space-delimited list of scopes that were granted',
    example: 'tasks:read tasks:write',
  })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({
    description: 'Error description if authorization failed',
    example: 'User denied the authorization request',
  })
  @IsString()
  @IsOptional()
  error_description?: string;
}
