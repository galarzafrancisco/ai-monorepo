import { ApiProperty } from '@nestjs/swagger';
import { PageSummaryDto } from './page-summary.dto';

export class PageListResponseDto {
  @ApiProperty({ type: [PageSummaryDto] })
  items!: PageSummaryDto[];
}
