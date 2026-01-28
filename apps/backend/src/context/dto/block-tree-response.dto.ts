import { ApiProperty } from '@nestjs/swagger';

export class BlockTreeResponseDto {
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
    description: 'Child blocks',
    type: [BlockTreeResponseDto],
    example: [],
  })
  children!: BlockTreeResponseDto[];

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
}
