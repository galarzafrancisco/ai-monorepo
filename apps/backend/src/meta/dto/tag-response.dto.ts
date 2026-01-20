import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaTagResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the tag',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the tag',
    example: 'bug',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Color for the tag (hex format)',
    example: '#FF5733',
  })
  color?: string;

  @ApiProperty({
    description: 'When the tag was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'When the tag was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: string;
}
