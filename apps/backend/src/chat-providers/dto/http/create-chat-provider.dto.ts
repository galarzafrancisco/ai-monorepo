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
}
