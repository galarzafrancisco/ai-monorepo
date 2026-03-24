import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateChatProviderDto {
  @ApiPropertyOptional({
    description: 'Display name for the chat provider',
    example: 'OpenAI Production',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'ID of the secret containing the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  secretId?: string;

  @ApiPropertyOptional({
    description: 'API key for the chat provider. If provided, a secret will be created automatically.',
    example: 'sk-...',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;
}
