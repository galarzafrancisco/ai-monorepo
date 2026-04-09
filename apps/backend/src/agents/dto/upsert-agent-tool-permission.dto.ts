import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpsertAgentToolPermissionDto {
  @ApiPropertyOptional({
    description:
      'Subset of scope IDs granted for this tool assignment. Leave empty for unscoped tools or no scope grants.',
    type: [String],
    example: ['tasks:read', 'tasks:write'],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  scopeIds: string[] = [];
}
