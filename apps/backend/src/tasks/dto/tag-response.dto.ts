import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TagEntity } from '../../meta/tag.entity';

export class TagResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the tag',
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

  /**
   * Factory method to create a TagResponseDto from a TagEntity.
   * Used by the WebSocket gateway to map domain entities to wire DTOs.
   */
  static fromEntity(tag: TagEntity): TagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
    };
  }
}
