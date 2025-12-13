import { IsNotEmpty, IsString, MaxLength, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePageDto {
  @ApiProperty({
    description: 'Title of the wiki page',
    example: 'How to onboard new agents',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Markdown content of the page',
    example: '# Welcome to Wikiroo\nThis is the onboarding guide.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description: 'Author of the page',
    example: 'Agent Roo',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  author!: string;

  @ApiPropertyOptional({
    description: 'Array of tag names to associate with the page',
    example: ['documentation', 'onboarding'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Parent page ID for nesting',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
