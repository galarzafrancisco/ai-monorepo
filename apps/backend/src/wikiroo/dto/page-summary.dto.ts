import { ApiProperty } from '@nestjs/swagger';
import { WikiTagResponseDto } from './wiki-tag-response.dto';

export class PageSummaryDto {
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
    description: 'Tags associated with the page',
    type: [WikiTagResponseDto],
    example: [{ id: '123', name: 'project-alpha', color: '#FF5733', description: 'Project Alpha notes', createdAt: '2025-01-01T12:00:00.000Z', updatedAt: '2025-01-01T12:00:00.000Z' }],
  })
  tags!: WikiTagResponseDto[];

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
