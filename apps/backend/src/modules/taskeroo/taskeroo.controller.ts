import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TaskerooService } from './taskeroo.service';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';
import { AssignTaskDto } from './assign-task.dto';
import { CreateCommentDto } from './create-comment.dto';
import { ChangeStatusDto } from './change-status.dto';
import { Task } from './task.entity';
import { Comment } from './comment.entity';
import {
  TaskNotFoundError,
  TaskNotAssignedError,
  InvalidStatusTransitionError,
  CommentRequiredError,
} from './taskeroo.errors';

@ApiTags('taskeroo')
@Controller('taskeroo')
export class TaskerooController {
  constructor(private readonly taskerooService: TaskerooService) {}

  @Post('tasks')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  async createTask(@Body() dto: CreateTaskDto): Promise<Task> {
    return await this.taskerooService.createTask(dto);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task description' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    try {
      return await this.taskerooService.updateTask(id, dto);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch('tasks/:id/assign')
  @ApiOperation({ summary: 'Assign a task to someone' })
  @ApiResponse({ status: 200, description: 'Task assigned successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async assignTask(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
  ): Promise<Task> {
    try {
      return await this.taskerooService.assignTask(id, dto);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteTask(@Param('id') id: string): Promise<void> {
    try {
      await this.taskerooService.deleteTask(id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks with optional filtering' })
  @ApiQuery({ name: 'assignee', required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  async listTasks(
    @Query('assignee') assignee?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<Task[]> {
    if (assignee) {
      return await this.taskerooService.listTasksByAssignee(assignee);
    }
    if (sessionId) {
      return await this.taskerooService.listTasksBySessionId(sessionId);
    }
    return await this.taskerooService.listAllTasks();
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTask(@Param('id') id: string): Promise<Task> {
    try {
      return await this.taskerooService.getTaskById(id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post('tasks/:id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<Comment> {
    try {
      return await this.taskerooService.addComment(id, dto);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch('tasks/:id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<Task> {
    try {
      return await this.taskerooService.changeStatus(id, dto);
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): never {
    if (error instanceof TaskNotFoundError) {
      throw new HttpException(
        {
          type: 'https://taskeroo.api/errors/task-not-found',
          title: 'Task Not Found',
          status: HttpStatus.NOT_FOUND,
          detail: error.message,
          instance: `/taskeroo/tasks/${error.taskId}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (error instanceof TaskNotAssignedError) {
      throw new HttpException(
        {
          type: 'https://taskeroo.api/errors/task-not-assigned',
          title: 'Task Not Assigned',
          status: HttpStatus.BAD_REQUEST,
          detail: error.message,
          instance: `/taskeroo/tasks/${error.taskId}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (error instanceof InvalidStatusTransitionError) {
      throw new HttpException(
        {
          type: 'https://taskeroo.api/errors/invalid-status-transition',
          title: 'Invalid Status Transition',
          status: HttpStatus.BAD_REQUEST,
          detail: error.message,
          currentStatus: error.currentStatus,
          newStatus: error.newStatus,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (error instanceof CommentRequiredError) {
      throw new HttpException(
        {
          type: 'https://taskeroo.api/errors/comment-required',
          title: 'Comment Required',
          status: HttpStatus.BAD_REQUEST,
          detail: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    throw error;
  }
}
