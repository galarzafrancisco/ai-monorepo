import { ApiProperty } from '@nestjs/swagger';

export class PageTreeResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the page',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Title of the wiki page',
    example: 'How to onboard new agents',
  })
  title!: string;

  @ApiProperty({
    description: 'Author of the wiki page',
    example: 'Agent Roo',
  })
  author!: string;

  @ApiProperty({
    description: 'Parent page ID (null if root page)',
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
    description: 'Child pages',
    type: [PageTreeResponseDto],
    example: [],
  })
  children!: PageTreeResponseDto[];

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
