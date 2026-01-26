import { ApiProperty } from '@nestjs/swagger';
import { FeedItemResponseDto } from './feed-item-response.dto';

export class FeedListResponseDto {
  @ApiProperty({
    description: 'List of feed items',
    type: [FeedItemResponseDto],
  })
  items!: FeedItemResponseDto[];

  @ApiProperty({
    description: 'Total number of feed items',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Items per page',
    example: 50,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages!: number;
}
