import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContextTagResponseDto {
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
