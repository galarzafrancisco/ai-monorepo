import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateServerDto {
  @ApiProperty({
    description: 'Display name of the MCP server',
    example: 'GitHub Integration',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Short description of the MCP server',
    example: 'Provides access to GitHub repositories and issues',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL that MCP Clients will use to connect to the server',
    example: 'http://localhost:3000/api/v1/taskeroo/tasks/mcp',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(2048)
  url?: string;
}
