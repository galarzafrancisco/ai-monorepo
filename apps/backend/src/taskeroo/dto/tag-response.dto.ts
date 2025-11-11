import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the tag',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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

  @ApiPropertyOptional({
    description: 'Description of the tag',
    example: 'Issues that need to be fixed',
  })
  description?: string;

  @ApiProperty({
    description: 'Timestamp when the tag was created',
    example: '2023-10-15T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the tag was last updated',
    example: '2023-10-15T10:00:00.000Z',
  })
  updatedAt!: string;
}
