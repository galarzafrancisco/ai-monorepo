import { ApiProperty } from '@nestjs/swagger';
import { AgentRunResponseDto } from './agent-run-response.dto';

export class AgentRunListResponseDto {
  @ApiProperty({
    description: 'List of agent runs',
    type: [AgentRunResponseDto],
  })
  items!: AgentRunResponseDto[];

  @ApiProperty({
    description: 'Total count of agent runs',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  limit!: number;
}
