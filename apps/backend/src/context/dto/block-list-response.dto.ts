import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { BlockSummaryDto } from './block-summary.dto';

export class BlockListResponseDto {
  @ApiProperty({
    description: 'List of context blocks',
    type: [BlockSummaryDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'How to onboard new agents',
        createdByActorId: '123e4567-e89b-12d3-a456-426614174000',
        createdBy: 'agent-roo',
        tags: [
          {
            id: '123',
            name: 'project-alpha',
            color: '#FF5733',
            description: 'Project Alpha notes',
            createdAt: '2025-01-01T12:00:00.000Z',
            updatedAt: '2025-01-01T12:00:00.000Z',
          },
        ],
        parentId: null,
        order: 0,
        createdAt: '2025-01-01T12:00:00.000Z',
        updatedAt: '2025-01-02T15:30:00.000Z',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => BlockSummaryDto)
  items!: BlockSummaryDto[];
}
