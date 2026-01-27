import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({
    description: 'Project unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Tag ID associated with this project',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag name (project:slug format)',
    example: 'project:taico',
  })
  tagName!: string;

  @ApiProperty({
    description: 'Tag color in hex format',
    example: '#FF6B6B',
  })
  tagColor?: string;

  @ApiProperty({
    description: 'Project slug',
    example: 'taico',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'AI task management platform',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Repository URL',
    example: 'https://github.com/user/repo',
  })
  repoUrl?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: string;
}
