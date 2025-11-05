import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateScopeDto {
  @ApiProperty({
    description: 'Unique scope identifier (e.g., tool:read, tool:write)',
    example: 'tool:read',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scopeId!: string;

  @ApiProperty({
    description: 'Description of what this scope grants access to',
    example: 'Read access to MCP tools',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
