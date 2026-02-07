import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchProjectsQueryDto {
  @ApiProperty({
    description: 'Search query',
    example: 'taico',
  })
  @IsString()
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Match threshold (0-1)',
    example: 0.3,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}
