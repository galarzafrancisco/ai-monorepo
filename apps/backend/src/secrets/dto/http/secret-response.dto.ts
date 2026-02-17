import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecretResponseDto {
  @ApiProperty({
    description: 'Secret identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the secret',
    example: 'OPENAI_API_KEY',
  })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Human-readable description',
    example: 'OpenAI API key for agent completions',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'ID of the actor who created this secret',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdByActorId!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Slug of the actor who created this secret',
    example: 'fran',
    nullable: true,
  })
  createdBy!: string | null;

  @ApiProperty({
    description: 'Row version for optimistic locking',
    example: 1,
  })
  rowVersion!: number;

  @ApiProperty({
    description: 'ISO timestamp when the secret was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'ISO timestamp when the secret was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: string;
}

export class SecretValueResponseDto {
  @ApiProperty({
    description: 'Secret identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the secret',
    example: 'OPENAI_API_KEY',
  })
  name!: string;

  @ApiProperty({
    description: 'The decrypted secret value',
    example: 'sk-...',
  })
  value!: string;
}
