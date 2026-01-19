import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPagesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter pages by tag name',
    example: 'tutorial',
  })
  @IsString()
  @IsOptional()
  tag?: string;
}
