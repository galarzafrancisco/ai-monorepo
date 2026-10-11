import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAiProviderDto {
  @ApiPropertyOptional({
    description: 'Display name for the AI provider',
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
    description:
      'API key for the AI provider, or service account JSON for Vertex AI. If provided, a secret will be created automatically.',
    example: 'sk-...',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'API base URL. Required for OpenAI-compatible providers.',
    example: 'http://localhost:11434/v1',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  baseUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Google Cloud project for Vertex AI. Blank falls back to the environment.',
    example: 'my-gcp-project',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  project?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Google Cloud location for Vertex AI. Blank falls back to the environment.',
    example: 'us-central1',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  location?: string | null;
}
