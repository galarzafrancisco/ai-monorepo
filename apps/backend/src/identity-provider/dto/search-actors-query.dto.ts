import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchActorsQueryDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'andrea',
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum score threshold (0-1, higher is stricter)',
    example: 0.3,
    default: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}
