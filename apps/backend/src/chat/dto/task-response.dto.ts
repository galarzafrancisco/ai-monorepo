import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the task',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Task name',
    example: 'Implement Chat Domain',
  })
  name!: string;

  @ApiProperty({
    description: 'Task description',
    example: 'Implement the chat domain with session entity',
  })
  description!: string;

  @ApiProperty({
    description: 'Task status',
    example: 'IN_PROGRESS',
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'Task assignee',
    example: 'claude-dev',
  })
  assignee!: string | null;
}
