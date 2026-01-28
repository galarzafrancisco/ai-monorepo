import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { BlockSummaryDto } from './block-summary.dto';

export class BlockListResponseDto {
  @ApiProperty({
    description: 'List of context blocks',
    type: [BlockSummaryDto],
  })
  @ValidateNested({ each: true })
  @Type(() => BlockSummaryDto)
  items!: BlockSummaryDto[];
}
