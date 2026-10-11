import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiProviderType } from '../../enums';

export class AiProviderResponseDto {
  @ApiProperty({
    description: 'AI provider identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the AI provider',
    example: 'OpenAI Production',
  })
  name!: string;

  @ApiProperty({
    description: 'Type of AI provider',
    enum: AiProviderType,
    example: AiProviderType.OPENAI,
  })
  type!: AiProviderType;

  @ApiPropertyOptional({
    type: String,
    description: 'ID of the secret containing the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  secretId!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'API base URL',
    example: 'http://localhost:11434/v1',
    nullable: true,
  })
  baseUrl!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Google Cloud project for Vertex AI',
    example: 'my-gcp-project',
    nullable: true,
  })
  project!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Google Cloud location for Vertex AI',
    example: 'us-central1',
    nullable: true,
  })
  location!: string | null;

  @ApiProperty({
    description: 'Whether this provider has all required configuration',
    example: true,
  })
  isConfigured!: boolean;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'ISO timestamp when the provider was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'ISO timestamp when the provider was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: string;
}
