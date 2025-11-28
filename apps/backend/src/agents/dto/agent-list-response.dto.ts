import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { AgentResponseDto } from './agent-response.dto';

export class AgentListResponseDto {
  @ApiProperty({
    description: 'List of agents',
    type: [AgentResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => AgentResponseDto)
  items!: AgentResponseDto[];

  @ApiProperty({
    description: 'Total number of agents matching the query',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages!: number;
}
