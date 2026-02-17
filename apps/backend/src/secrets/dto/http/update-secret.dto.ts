import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSecretDto {
  @ApiPropertyOptional({
    description: 'New name for the secret',
    example: 'OPENAI_API_KEY_V2',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'New description for the secret',
    example: 'Updated OpenAI API key',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'New secret value (will be encrypted at rest)',
    example: 'sk-...',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  value?: string;
}
