import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TaskerooService } from './taskeroo.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { TaskParamsDto } from './dto/task-params.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskListResponseDto } from './dto/task-list-response.dto';
import { TaskResult, CommentResult } from './dto/service/taskeroo.service.types';

@ApiTags('Task')
@Controller('taskeroo/tasks')
export class TaskerooController {
  constructor(private readonly taskerooService: TaskerooService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiCreatedResponse({
    type: TaskResponseDto,
    description: 'Task created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTask(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    const result = await this.taskerooService.createTask({
      name: dto.name,
      description: dto.description,
      assignee: dto.assignee,
      sessionId: dto.sessionId,
    });
    return this.mapResultToResponse(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task description' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Task updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateTask(
    @Param() params: TaskParamsDto,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const result = await this.taskerooService.updateTask(params.id, {
      description: dto.description,
    });
    return this.mapResultToResponse(result);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a task to someone' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Task assigned successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async assignTask(
    @Param() params: TaskParamsDto,
    @Body() dto: AssignTaskDto,
  ): Promise<TaskResponseDto> {
    const result = await this.taskerooService.assignTask(params.id, {
      assignee: dto.assignee,
      sessionId: dto.sessionId,
    });
    return this.mapResultToResponse(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiNoContentResponse({ description: 'Task deleted successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async deleteTask(@Param() params: TaskParamsDto): Promise<void> {
    await this.taskerooService.deleteTask(params.id);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with optional filtering and pagination' })
  @ApiOkResponse({
    type: TaskListResponseDto,
    description: 'Paginated list of tasks',
  })
  async listTasks(
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskListResponseDto> {
    const result = await this.taskerooService.listTasks({
      assignee: query.assignee,
      sessionId: query.sessionId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => this.mapResultToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Task found' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async getTask(@Param() params: TaskParamsDto): Promise<TaskResponseDto> {
    const result = await this.taskerooService.getTaskById(params.id);
    return this.mapResultToResponse(result);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiCreatedResponse({
    type: CommentResponseDto,
    description: 'Comment added successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addComment(
    @Param() params: TaskParamsDto,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const result = await this.taskerooService.addComment(params.id, {
      commenterName: dto.commenterName,
      content: dto.content,
    });
    return this.mapCommentResultToResponse(result);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Status changed successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({
    description: 'Invalid status transition or comment required',
  })
  async changeStatus(
    @Param() params: TaskParamsDto,
    @Body() dto: ChangeTaskStatusDto,
  ): Promise<TaskResponseDto> {
    const result = await this.taskerooService.changeStatus(params.id, {
      status: dto.status,
      comment: dto.comment,
    });
    return this.mapResultToResponse(result);
  }

  private mapResultToResponse(result: TaskResult): TaskResponseDto {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      status: result.status,
      assignee: result.assignee ?? '',
      sessionId: result.sessionId ?? '',
      comments: result.comments.map((c) => this.mapCommentResultToResponse(c)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapCommentResultToResponse(
    result: CommentResult,
  ): CommentResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      commenterName: result.commenterName,
      content: result.content,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
