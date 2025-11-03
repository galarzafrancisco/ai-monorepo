import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
