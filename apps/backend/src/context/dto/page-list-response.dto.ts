import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PageSummaryDto } from './page-summary.dto';

export class PageListResponseDto {
  @ApiProperty({
    description: 'List of wiki pages',
    type: [PageSummaryDto],
  })
  @ValidateNested({ each: true })
  @Type(() => PageSummaryDto)
  items!: PageSummaryDto[];
}
