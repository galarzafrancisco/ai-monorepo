import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ServerResponseDto } from './server-response.dto';

export class ServerListResponseDto {
  @ApiProperty({
    description: 'List of MCP servers',
    type: [ServerResponseDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        providedId: 'github-integration',
        name: 'GitHub Integration',
        description: 'Provides access to GitHub repositories and issues',
        url: 'http://localhost:3000/api/v1/tasks/tasks/mcp',
        createdAt: '2025-11-05T08:00:00.000Z',
        updatedAt: '2025-11-05T08:00:00.000Z',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => ServerResponseDto)
  items!: ServerResponseDto[];

  @ApiProperty({
    description: 'Total number of servers',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
  })
  limit!: number;
}
