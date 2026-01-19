import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagResponseDto {
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
}
