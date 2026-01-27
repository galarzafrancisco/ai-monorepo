import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project slug (e.g., "taico")',
    example: 'taico',
  })
  @IsString()
  slug!: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'AI task management platform',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Repository URL for code projects',
    example: 'https://github.com/user/repo',
  })
  @IsUrl()
  @IsOptional()
  repoUrl?: string;

  @ApiPropertyOptional({
    description: 'Tag color in hex format',
    example: '#FF6B6B',
  })
  @IsString()
  @IsOptional()
  color?: string;
}
