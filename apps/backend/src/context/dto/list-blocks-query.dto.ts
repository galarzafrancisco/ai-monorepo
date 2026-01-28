import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListBlocksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter blocks by tag name',
    example: 'tutorial',
  })
  @IsString()
  @IsOptional()
  tag?: string;
}
