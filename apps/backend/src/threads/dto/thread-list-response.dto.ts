import { ApiProperty } from '@nestjs/swagger';
import { ThreadListItemResponseDto } from './thread-list-item-response.dto';

export class ThreadListResponseDto {
  @ApiProperty({
    description: 'Array of thread list items',
    type: [ThreadListItemResponseDto],
  })
  items!: ThreadListItemResponseDto[];

  @ApiProperty({ description: 'Total number of threads', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;
}
