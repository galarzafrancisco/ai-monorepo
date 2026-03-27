import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RequestAgentExecutionTokenDto {
  @ApiProperty({
    description: 'Scopes to grant to the short-lived execution token.',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @ApiPropertyOptional({
    description:
      'Lifetime of the short-lived execution token in seconds. Defaults to the server MCP access token duration.',
    example: 600,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  expirationSeconds?: number;
}
