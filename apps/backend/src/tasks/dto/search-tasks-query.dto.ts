import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchTasksQueryDto {
  @ApiProperty({
    description:
      'What to look for. Keywords, a partial title or a question in plain language all work.',
    example: 'authentication',
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results. Defaults to the configured default limit.',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
