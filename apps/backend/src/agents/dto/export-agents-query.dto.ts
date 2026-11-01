import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExportAgentsQueryDto {
  @ApiPropertyOptional({
    description: 'Export a single agent by slug. Omit to export every agent.',
    example: 'buddy',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  slug?: string;
}
