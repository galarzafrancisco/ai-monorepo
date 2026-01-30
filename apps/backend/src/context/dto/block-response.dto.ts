import { ApiProperty } from '@nestjs/swagger';
import { ContextTagResponseDto } from './wiki-tag-response.dto';
import { ContextBlockEntity } from '../block.entity';

export class BlockResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the block',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Title of the context block',
    example: 'How to onboard new agents',
  })
  title!: string;

  @ApiProperty({
    description: 'Markdown content of the context block',
    example: '# Welcome to Context',
  })
  content!: string;

  @ApiProperty({
    description: 'Actor ID of the block creator',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdByActorId!: string;

  @ApiProperty({
    type: String,
    description: 'Creator slug from the associated actor',
    example: 'agent-roo',
    nullable: true,
  })
  createdBy!: string | null;

  @ApiProperty({
    description: 'Tags associated with the block',
    type: [ContextTagResponseDto],
    example: [
      {
        id: '123',
        name: 'project-alpha',
        color: '#FF5733',
        description: 'Project Alpha notes',
        createdAt: '2025-01-01T12:00:00.000Z',
        updatedAt: '2025-01-01T12:00:00.000Z',
      },
    ],
  })
  tags!: ContextTagResponseDto[];

  @ApiProperty({
    description: 'Parent block ID (null if root block)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  parentId!: string | null;

  @ApiProperty({
    description: 'Order within siblings',
    example: 0,
  })
  order!: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-02T15:30:00.000Z',
  })
  updatedAt!: string;

  /**
   * Static factory method to create a DTO from a domain entity.
   * This provides explicit, centralized mapping from entity to wire representation.
   */
  static fromEntity(block: ContextBlockEntity): BlockResponseDto {
    const dto = new BlockResponseDto();
    dto.id = block.id;
    dto.title = block.title;
    dto.content = block.content;
    dto.createdByActorId = block.createdByActorId;
    dto.createdBy = block.createdBy;
    dto.tags =
      block.tags?.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      })) || [];
    dto.parentId = block.parentId ?? null;
    dto.order = block.order;
    dto.createdAt = block.createdAt.toISOString();
    dto.updatedAt = block.updatedAt.toISOString();
    return dto;
  }
}
