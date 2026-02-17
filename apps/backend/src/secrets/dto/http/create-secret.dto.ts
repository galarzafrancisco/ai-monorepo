import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSecretDto {
  @ApiProperty({
    description: 'Unique name for the secret',
    example: 'OPENAI_API_KEY',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the secret',
    example: 'OpenAI API key for agent completions',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'The secret value (will be encrypted at rest)',
    example: 'sk-...',
  })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
