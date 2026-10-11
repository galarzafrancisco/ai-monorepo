import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ChatProviderType } from '../../enums';

export class CreateChatProviderDto {
  @ApiProperty({
    description: 'Display name for the chat provider',
    example: 'OpenAI Production',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Type of chat provider',
    enum: ChatProviderType,
    example: ChatProviderType.OPENAI,
  })
  @IsEnum(ChatProviderType)
  @IsNotEmpty()
  type!: ChatProviderType;

  @ApiPropertyOptional({
    description: 'ID of the secret containing the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  secretId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Model to use with this provider. Blank uses the provider default.',
    example: 'claude-opus-5-5',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  modelId?: string | null;

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
