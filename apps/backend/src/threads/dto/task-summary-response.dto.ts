import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorResponseDto } from '../../identity-provider/dto/actor-response.dto';
import { TaskStatus } from '../../tasks/enums';
import { TagResponseDto } from '../../tasks/dto/tag-response.dto';
import { InputRequestResponseDto } from '../../tasks/dto/input-request-response.dto';

export class TaskSummaryResponseDto {
  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Task name',
    example: 'Implement user authentication',
  })
  name!: string;

  @ApiProperty({
    description: 'Task description',
    example: 'Add JWT-based authentication to the API',
  })
  description!: string;

  @ApiProperty({
    description: 'Task status',
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
  })
  status!: TaskStatus;

  @ApiPropertyOptional({
    description: 'Assignee actor details',
    type: ActorResponseDto,
    nullable: true,
  })
  assigneeActor!: ActorResponseDto | null;

  @ApiProperty({
    description: 'Creator actor details',
    type: ActorResponseDto,
  })
  createdByActor!: ActorResponseDto;

  @ApiProperty({
    description: 'Tags associated with the task',
    type: [TagResponseDto],
  })
  tags!: TagResponseDto[];

  @ApiProperty({
    description: 'Number of comments on the task',
    example: 5,
  })
  commentCount!: number;

  @ApiProperty({
    description: 'Input requests associated with the task',
    type: [InputRequestResponseDto],
  })
  inputRequests!: InputRequestResponseDto[];

  @ApiProperty({
    description: 'Task last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt!: string;
}
