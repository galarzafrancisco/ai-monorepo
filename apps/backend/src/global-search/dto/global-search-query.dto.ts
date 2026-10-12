import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SearchResultType } from '../../search/enums';

export class GlobalSearchQueryDto {
  @ApiProperty({
    description:
      'What to look for. Keywords, a partial title or a question in plain language all work.',
    example: 'how do we deploy to production',
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

  @ApiPropertyOptional({
    description: 'Only return these kinds of result. All kinds when omitted.',
    enum: SearchResultType,
    enumName: 'SearchResultType',
    isArray: true,
    example: [SearchResultType.TASK, SearchResultType.CONTEXT_BLOCK],
  })
  @IsOptional()
  // Accepts ?types=task&types=tool and ?types=task,tool. A missing value stays missing.
  @Transform(({ value }) =>
    value === undefined || value === null || Array.isArray(value)
      ? value
      : String(value).split(','),
  )
  @IsArray()
  @IsEnum(SearchResultType, { each: true })
  types?: SearchResultType[];
}
