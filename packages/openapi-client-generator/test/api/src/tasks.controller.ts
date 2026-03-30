import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ enum: ['pending', 'in_progress', 'completed'], required: false })
  status?: 'pending' | 'in_progress' | 'completed';
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ['pending', 'in_progress', 'completed'] })
  status: 'pending' | 'in_progress' | 'completed';
}

export class TaskDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ enum: ['pending', 'in_progress', 'completed'] })
  status: 'pending' | 'in_progress' | 'completed';

  @ApiProperty({ type: String })
  createdAt: string;
}

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  private tasks: Map<string, TaskDto> = new Map([
    [
      '1',
      {
        id: '1',
        title: 'Task 1',
        description: 'First task',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ],
  ]);

  @Get()
  @ApiOperation({ summary: 'List all tasks' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'in_progress', 'completed'] })
  @ApiResponse({ status: 200, type: [TaskDto] })
  listTasks(@Query('status') status?: string): TaskDto[] {
    const tasks = Array.from(this.tasks.values());
    if (status) {
      return tasks.filter((t) => t.status === status);
    }
    return tasks;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, type: TaskDto })
  getTask(@Param('id') id: string): TaskDto | null {
    return this.tasks.get(id) || null;
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 201, type: TaskDto })
  createTask(@Body() dto: CreateTaskDto): TaskDto {
    const id = String(this.tasks.size + 1);
    const task: TaskDto = {
      id,
      ...dto,
      status: dto.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    this.tasks.set(id, task);
    return task;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiResponse({ status: 200, type: TaskDto })
  updateTaskStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): TaskDto | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = dto.status;
    return task;
  }
}
