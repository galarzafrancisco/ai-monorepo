import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsGitUrl } from '../validators/is-git-url.validator';

export class PatchProjectDto {
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
}
