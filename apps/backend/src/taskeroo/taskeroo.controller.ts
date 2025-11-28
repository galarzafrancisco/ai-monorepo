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
  Req,
  All,
  Res,
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
import type { Request, Response } from "express";
import { TaskerooService } from './taskeroo.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { AddTagDto } from './dto/add-tag.dto';
import { TaskParamsDto } from './dto/task-params.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskListResponseDto } from './dto/task-list-response.dto';
import { TaskResult, CommentResult, TagResult } from './dto/service/taskeroo.service.types';
import { TaskerooMcpGateway } from './taskeroo.mcp.gateway';

@ApiTags('Task')
@Controller('taskeroo/tasks')
export class TaskerooController {
  constructor(
    private readonly taskerooService: TaskerooService,
    private readonly gateway: TaskerooMcpGateway,
  ) {}

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
      tagNames: dto.tagNames,
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
      name: dto.name,
      description: dto.description,
      assignee: dto.assignee,
      sessionId: dto.sessionId,
      tagNames: dto.tagNames,
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
      tag: query.tag,
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

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add a tag to a task' })
  @ApiCreatedResponse({
    type: TaskResponseDto,
    description: 'Tag added to task successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToTask(
    @Param() params: TaskParamsDto,
    @Body() dto: AddTagDto,
  ): Promise<TaskResponseDto> {
    const result = await this.taskerooService.addTagToTask(params.id, {
      name: dto.name,
      color: dto.color,
    });
    return this.mapResultToResponse(result);
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a task' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Tag removed from task successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async removeTagFromTask(
    @Param('id') taskId: string,
    @Param('tagId') tagId: string,
  ): Promise<TaskResponseDto> {
    const result = await this.taskerooService.removeTagFromTask(taskId, tagId);
    return this.mapResultToResponse(result);
  }

  @Get('tags/all')
  @ApiOperation({ summary: 'Get all tags' })
  @ApiOkResponse({
    type: [TagResponseDto],
    description: 'List of all tags',
  })
  async getAllTags(): Promise<TagResponseDto[]> {
    const result = await this.taskerooService.getAllTags();
    return result.map((tag) => this.mapTagResultToResponse(tag));
  }

  @Delete('tags/:tagId')
  @ApiOperation({ summary: 'Delete a tag from the system' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tag deleted successfully' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  async deleteTag(@Param('tagId') tagId: string): Promise<void> {
    await this.taskerooService.deleteTag(tagId);
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
      tags: result.tags.map((t) => this.mapTagResultToResponse(t)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @All('mcp')
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.gateway.handleRequest(req, res);
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

  private mapTagResultToResponse(result: TagResult): TagResponseDto {
    return {
      name: result.name,
      color: result.color,
    };
  }
}
