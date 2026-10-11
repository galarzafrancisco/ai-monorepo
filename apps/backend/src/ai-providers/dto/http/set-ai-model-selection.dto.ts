import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SetAiModelSelectionDto {
  @ApiProperty({
    description: 'ID of the AI provider to call',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  aiProviderId!: string;

  @ApiProperty({
    description: 'Model id as the provider names it',
    example: 'claude-haiku-5-5',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  modelId!: string;
}
