import { ApiProperty } from '@nestjs/swagger';
import { PageSummaryDto } from './page-summary.dto';

export class PageListResponseDto {
  @ApiProperty({
    description: 'List of wiki pages',
    type: [PageSummaryDto],
  })
  items!: PageSummaryDto[];
}
