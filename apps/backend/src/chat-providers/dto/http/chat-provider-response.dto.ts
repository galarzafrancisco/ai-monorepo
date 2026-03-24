import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatProviderType } from '../../enums';

export class ChatProviderResponseDto {
  @ApiProperty({
    description: 'Chat provider identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the chat provider',
    example: 'OpenAI Production',
  })
  name!: string;

  @ApiProperty({
    description: 'Type of chat provider',
    enum: ChatProviderType,
    example: ChatProviderType.OPENAI,
  })
  type!: ChatProviderType;

  @ApiPropertyOptional({
    type: String,
    description: 'ID of the secret containing the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  secretId!: string | null;

  @ApiProperty({
    description: 'Whether this provider is currently active',
    example: true,
  })
  isActive!: boolean;

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
