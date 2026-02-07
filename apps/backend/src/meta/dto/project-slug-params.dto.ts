import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ProjectSlugParamsDto {
  @ApiProperty({
    description: 'Project slug',
    example: 'taico',
  })
  @IsString()
  @MaxLength(255)
  slug!: string;
}
