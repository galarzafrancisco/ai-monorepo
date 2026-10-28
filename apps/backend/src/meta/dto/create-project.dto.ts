import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';
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
    type: String,
    nullable: true,
    description: 'GitHub connection for this project. Null picks one automatically from the repository owner.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  githubConnectionId?: string | null;

  @ApiPropertyOptional({
    description: "Whether workers get a token from the project's GitHub connection to clone and push",
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  githubForWorker?: boolean;

  @ApiPropertyOptional({
    description: 'Tag color in hex format',
    example: '#FF6B6B',
  })
  @IsString()
  @IsOptional()
  color?: string;
}
