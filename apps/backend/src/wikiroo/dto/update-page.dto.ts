import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePageDto {
  @ApiPropertyOptional({
    description: 'Updated title of the wiki page',
    example: 'Updated onboarding guide',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated markdown content of the page',
    example: '## Updated content',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated author of the page',
    example: 'Agent Roo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;
}
