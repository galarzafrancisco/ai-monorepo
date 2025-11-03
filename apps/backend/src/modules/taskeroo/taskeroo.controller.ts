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
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';
import { AssignTaskDto } from './assign-task.dto';
import { CreateCommentDto } from './create-comment.dto';
import { ChangeStatusDto } from './change-status.dto';
import { TaskResponseDto } from './task-response.dto';
import { CommentResponseDto } from './comment-response.dto';
import { TaskParamsDto } from './task-params.dto';
import { ListTasksQueryDto } from './list-tasks-query.dto';

@ApiTags('taskeroo')
@Controller('taskeroo')
export class TaskerooController {
  constructor(private readonly taskerooService: TaskerooService) {}

  @Post('tasks')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiCreatedResponse({ type: TaskResponseDto, description: 'Task created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTask(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    const task = await this.taskerooService.createTask(dto);
    return this.mapTaskToResponse(task);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task description' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Task updated successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateTask(
    @Param() params: TaskParamsDto,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.taskerooService.updateTask(params.id, dto);
    return this.mapTaskToResponse(task);
  }

  @Patch('tasks/:id/assign')
  @ApiOperation({ summary: 'Assign a task to someone' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Task assigned successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async assignTask(
    @Param() params: TaskParamsDto,
    @Body() dto: AssignTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.taskerooService.assignTask(params.id, dto);
    return this.mapTaskToResponse(task);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiNoContentResponse({ description: 'Task deleted successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async deleteTask(@Param() params: TaskParamsDto): Promise<void> {
    await this.taskerooService.deleteTask(params.id);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks with optional filtering' })
  @ApiOkResponse({
    type: [TaskResponseDto],
    description: 'List of tasks',
  })
  async listTasks(@Query() query: ListTasksQueryDto): Promise<TaskResponseDto[]> {
    let tasks;
    if (query.assignee) {
      tasks = await this.taskerooService.listTasksByAssignee(query.assignee);
    } else if (query.sessionId) {
      tasks = await this.taskerooService.listTasksBySessionId(query.sessionId);
    } else {
      tasks = await this.taskerooService.listAllTasks();
    }
    return tasks.map((task) => this.mapTaskToResponse(task));
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Task found' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async getTask(@Param() params: TaskParamsDto): Promise<TaskResponseDto> {
    const task = await this.taskerooService.getTaskById(params.id);
    return this.mapTaskToResponse(task);
  }

  @Post('tasks/:id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiCreatedResponse({ type: CommentResponseDto, description: 'Comment added successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addComment(
    @Param() params: TaskParamsDto,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.taskerooService.addComment(params.id, dto);
    return this.mapCommentToResponse(comment);
  }

  @Patch('tasks/:id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Status changed successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid status transition or comment required' })
  async changeStatus(
    @Param() params: TaskParamsDto,
    @Body() dto: ChangeStatusDto,
  ): Promise<TaskResponseDto> {
    const task = await this.taskerooService.changeStatus(params.id, dto);
    return this.mapTaskToResponse(task);
  }

  private mapTaskToResponse(task: any): TaskResponseDto {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
      sessionId: task.sessionId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private mapCommentToResponse(comment: any): CommentResponseDto {
    return {
      id: comment.id,
      taskId: comment.taskId,
      commenterName: comment.commenterName,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
