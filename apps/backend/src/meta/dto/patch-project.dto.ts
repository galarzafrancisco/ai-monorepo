import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchProjectDto {
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
}
