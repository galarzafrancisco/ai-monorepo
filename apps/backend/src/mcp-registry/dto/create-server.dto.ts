import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUrl } from 'class-validator';

export class CreateServerDto {
  @ApiProperty({
    description: 'Human-readable unique identifier for the MCP server',
    example: 'github-integration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  providedId!: string;

  @ApiProperty({
    description: 'Display name of the MCP server',
    example: 'GitHub Integration',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Short description of the MCP server',
    example: 'Provides access to GitHub repositories and issues',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

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
