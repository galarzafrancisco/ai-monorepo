import { ApiProperty } from '@nestjs/swagger';

export enum SearchResultType {
  TASK = 'task',
  CONTEXT_BLOCK = 'context_block',
  AGENT = 'agent',
  PROJECT = 'project',
  TAG = 'tag',
}

export class GlobalSearchResultDto {
  @ApiProperty({
    description: 'Result ID',
    example: 'ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  id!: string;

  @ApiProperty({
    description: 'Result type',
    enum: SearchResultType,
    example: SearchResultType.TASK,
  })
  type!: SearchResultType;

  @ApiProperty({
    description: 'Result title/name',
    example: 'Implement authentication',
  })
  title!: string;

  @ApiProperty({
    description: 'Match confidence score (0-1, higher is better)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  score!: number;

  @ApiProperty({
    description: 'Frontend URL path to navigate to this resource',
    example: '/tasks/task/ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  url!: string;
}
