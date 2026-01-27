import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContextTagResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the tag',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the tag',
    example: 'project-alpha',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Color for the tag (hex format)',
    example: '#FF5733',
  })
  color?: string;
}
