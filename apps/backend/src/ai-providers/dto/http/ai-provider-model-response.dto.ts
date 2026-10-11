import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiModelKind } from '../../enums';

export class AiProviderModelResponseDto {
  @ApiProperty({
    description: 'Model id as the provider names it',
    example: 'claude-haiku-5-5',
  })
  id!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Human-readable name, when the provider gives one',
    example: 'Claude Haiku 5.5',
    nullable: true,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'What the model is for',
    enum: AiModelKind,
    example: AiModelKind.LANGUAGE,
  })
  kind!: AiModelKind;
}
