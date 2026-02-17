import { ApiProperty } from '@nestjs/swagger';
import { ThreadMessageResponseDto } from './thread-message-response.dto';
import { ListThreadMessagesResult } from './service/threads.service.types';

export class ListThreadMessagesResponseDto {
  @ApiProperty({
    description: 'List of messages',
    type: [ThreadMessageResponseDto],
  })
  items!: ThreadMessageResponseDto[];

  @ApiProperty({
    description: 'Total number of messages',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit!: number;

  static fromResult(result: ListThreadMessagesResult): ListThreadMessagesResponseDto {
    return {
      items: result.items.map((item) => ThreadMessageResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
