import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsGitUrl } from '../validators/is-git-url.validator';

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
    description: 'Repository URL for code projects (supports HTTP/HTTPS and SSH URLs)',
    example: 'https://github.com/user/repo',
  })
  @IsGitUrl()
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
