import { ApiProperty } from '@nestjs/swagger';
import { SessionResponseDto } from './session-response.dto';

export class SessionListResponseDto {
  @ApiProperty({
    description: 'List of sessions',
    type: [SessionResponseDto],
  })
  items!: SessionResponseDto[];

  @ApiProperty({
    description: 'Total number of sessions matching the filters',
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
}
