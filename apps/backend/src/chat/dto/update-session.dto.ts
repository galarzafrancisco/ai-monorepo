import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSessionDto {
  @ApiPropertyOptional({
    description: 'Human-readable title for this session',
    example: 'Updated Chat Title',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional project label for this session',
    example: 'project:banana-mcp',
  })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiPropertyOptional({
    description: 'Whether the session should be archived',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the session should be pinned',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
