import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { TaskResponseDto } from './task-response.dto';

export class TaskBoardColumnResponseDto {
  @ApiProperty({
    description: 'List of tasks for this column',
    type: () => [TaskResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => TaskResponseDto)
  items!: TaskResponseDto[];

  @ApiProperty({
    description: 'Total number of tasks in this status column',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Whether there are more tasks available after this slice',
    example: true,
  })
  hasMore!: boolean;

  @ApiPropertyOptional({
    description: 'Cursor to fetch the next page for this status column',
    example: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTAyLTI4VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtMSJ9',
    nullable: true,
  })
  nextCursor!: string | null;
}

export class TaskBoardColumnsResponseDto {
  @ApiProperty({
    type: () => TaskBoardColumnResponseDto,
    description: 'Tasks in NOT_STARTED status',
  })
  @ValidateNested()
  @Type(() => TaskBoardColumnResponseDto)
  NOT_STARTED!: TaskBoardColumnResponseDto;

  @ApiProperty({
    type: () => TaskBoardColumnResponseDto,
    description: 'Tasks in IN_PROGRESS status',
  })
  @ValidateNested()
  @Type(() => TaskBoardColumnResponseDto)
  IN_PROGRESS!: TaskBoardColumnResponseDto;

  @ApiProperty({
    type: () => TaskBoardColumnResponseDto,
    description: 'Tasks in FOR_REVIEW status',
  })
  @ValidateNested()
  @Type(() => TaskBoardColumnResponseDto)
  FOR_REVIEW!: TaskBoardColumnResponseDto;

  @ApiProperty({
    type: () => TaskBoardColumnResponseDto,
    description: 'Tasks in DONE status',
  })
  @ValidateNested()
  @Type(() => TaskBoardColumnResponseDto)
  DONE!: TaskBoardColumnResponseDto;
}

export class TaskListResponseDto {
  @ApiProperty({
    description: 'Total number of tasks matching the filters',
    example: 120,
  })
  total!: number;

  @ApiProperty({
    description: 'Number of tasks returned per status column',
    example: 50,
  })
  columnLimit!: number;

  @ApiProperty({
    description: 'Task slices grouped by status',
    type: () => TaskBoardColumnsResponseDto,
  })
  @ValidateNested()
  @Type(() => TaskBoardColumnsResponseDto)
  columns!: TaskBoardColumnsResponseDto;
}
