import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AiProviderConnectionStatus } from '../../enums';

export class AiProviderConnectionResponseDto {
  @ApiProperty({ description: 'AI provider identifier' })
  aiProviderId!: string;

  @ApiProperty({
    description: 'State of your own connection to the provider',
    enum: AiProviderConnectionStatus,
    example: AiProviderConnectionStatus.CONNECTED,
  })
  status!: AiProviderConnectionStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Email of the connected account',
    nullable: true,
  })
  accountEmail!: string | null;

  @ApiProperty({
    description: 'Whether requests can run on your plan right now',
  })
  canUsePlan!: boolean;

  @ApiProperty({
    description:
      'Whether turns nobody typed (task updates) may run on your plan',
  })
  automatedTurnsAllowed!: boolean;

  @ApiProperty({
    description: 'Whether a sign-in was started and not finished',
  })
  isAuthorizationPending!: boolean;

  @ApiPropertyOptional({
    type: String,
    description:
      "The provider's code for the last failed request, cleared by the next success",
    example: 'subscription_sharing_usage_limit_exceeded',
    nullable: true,
  })
  lastErrorCode!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'ISO timestamp of the last failed request',
    nullable: true,
  })
  lastErrorAt!: string | null;

  @ApiProperty({ description: 'Where you see and manage your plan usage' })
  manageUsageUrl!: string;
}

export class StartAiProviderAuthorizationResponseDto {
  @ApiProperty({
    description: 'Address to open in the browser to sign in at the provider',
  })
  authorizationUrl!: string;

  @ApiProperty({
    description:
      'ISO timestamp after which this sign-in can no longer be finished',
  })
  expiresAt!: string;
}

/**
 * What the provider sent back to the redirect address. Send either the whole
 * address in `callbackUrl`, or its query parameters one by one.
 */
export class CompleteAiProviderAuthorizationDto {
  @ApiPropertyOptional({
    description: 'The full address the browser was sent back to, pasted as is',
    example: 'http://127.0.0.1:41873/auth/callback?code=...&state=...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'The `state` query parameter' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  state?: string;

  @ApiPropertyOptional({ description: 'The `code` query parameter' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  code?: string;

  @ApiPropertyOptional({ description: 'The `client_id` query parameter' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  clientId?: string;

  @ApiPropertyOptional({ description: 'The `error` query parameter' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  error?: string;

  @ApiPropertyOptional({
    description: 'The `error_description` query parameter',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  errorDescription?: string;
}

export class UpdateAiProviderConnectionDto {
  @ApiProperty({
    description:
      'Allow turns nobody typed (task updates in threads you subscribed to) to run on your plan',
  })
  @IsBoolean()
  automatedTurnsAllowed!: boolean;
}

export class DisconnectAiProviderResponseDto {
  @ApiProperty({
    description:
      'False when the provider could not be told. The tokens stored in Taico are removed either way.',
  })
  revokedAtProvider!: boolean;
}
