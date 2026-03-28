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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateArtefactDto } from './dto/create-artefact.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { ArtefactResponseDto } from './dto/artefact-response.dto';
import { InputRequestResponseDto } from './dto/input-request-response.dto';
import { CreateInputRequestDto } from './dto/create-input-request.dto';
import { AnswerInputRequestDto } from './dto/answer-input-request.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { CreateTagDto } from '../meta/dto/create-tag.dto';
import { TaskParamsDto } from './dto/task-params.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskListResponseDto } from './dto/task-list-response.dto';
import { SearchTasksQueryDto } from './dto/search-tasks-query.dto';
import { TaskSearchResultDto } from './dto/task-search-result.dto';
import { TasksMcpGateway } from './tasks.mcp.gateway';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type {
  AuthContext,
  UserContext,
} from '../auth/guards/context/auth-context.types';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from './tasks.scopes';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { CurrentAuth } from 'src/auth/guards/decorators/current-auth.decorator';
import { CurrentRunId } from 'src/auth/guards/decorators/current-run-id.decorator';
import { CurrentExecutionId } from 'src/auth/guards/decorators/current-execution-id.decorator';

@ApiTags('Task')
@ApiCookieAuth('JWT-Cookie')
@Controller('tasks/tasks')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class TasksController {
  constructor(
    private readonly TasksService: TasksService,
    private readonly gateway: TasksMcpGateway,
  ) {}

  @Post()
  @RequireScopes(TasksScopes.READ.id)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiCreatedResponse({
    type: TaskResponseDto,
    description: 'Task created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: UserContext,
    @CurrentExecutionId() executionId: string | undefined,
    @CurrentRunId() runId: string | undefined,
  ): Promise<TaskResponseDto> {
    // If either execution-id or run-id is present, create task in thread (with context inheritance)
    const result =
      executionId || runId
        ? await this.TasksService.createTaskInThread({
            name: dto.name,
            description: dto.description,
            assigneeActorId: dto.assigneeActorId,
            sessionId: dto.sessionId,
            tagNames: dto.tagNames,
            createdByActorId: user.actorId,
            dependsOnIds: dto.dependsOnIds,
            executionId,
            runId,
          })
        : await this.TasksService.createTask({
            name: dto.name,
            description: dto.description,
            assigneeActorId: dto.assigneeActorId,
            sessionId: dto.sessionId,
            tagNames: dto.tagNames,
            createdByActorId: user.actorId,
            dependsOnIds: dto.dependsOnIds,
          });
    return TaskResponseDto.fromResult(result);
  }

  @Patch(':id')
  @RequireScopes(TasksScopes.WRITE.id)
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
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.updateTask(
      params.id,
      {
        name: dto.name,
        description: dto.description,
        assigneeActorId: dto.assigneeActorId,
        sessionId: dto.sessionId,
        tagNames: dto.tagNames,
        dependsOnIds: dto.dependsOnIds,
      },
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Patch(':id/assign')
  @RequireScopes(TasksScopes.WRITE.id)
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
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.assignTask(
      params.id,
      {
        assigneeActorId: dto.assigneeActorId,
        sessionId: dto.sessionId,
      },
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Patch(':id/assign-to-me')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Assign a task to the current user' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Task assigned to current user successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async assignTaskToMe(
    @Param() params: TaskParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.assignTask(
      params.id,
      {
        assigneeActorId: user.actorId,
      },
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Delete(':id')
  @RequireScopes(TasksScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiNoContentResponse({ description: 'Task deleted successfully' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async deleteTask(
    @Param() params: TaskParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    await this.TasksService.deleteTask(params.id, user.actorId);
  }

  @Get()
  @ApiOperation({
    summary: 'List tasks with optional filtering and pagination',
  })
  @ApiOkResponse({
    type: TaskListResponseDto,
    description: 'Paginated list of tasks',
  })
  async listTasks(
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskListResponseDto> {
    const result = await this.TasksService.listTasks({
      assignee: query.assignee,
      sessionId: query.sessionId,
      tag: query.tag,
      page: query.page ?? 1,
      limit: query.limit ?? 200,
    });

    return {
      items: result.items.map((item) => TaskResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Get('search/query')
  @ApiOperation({ summary: 'Search tasks by query string' })
  @ApiOkResponse({
    type: [TaskSearchResultDto],
    description: 'Search results sorted by relevance',
  })
  async searchTasks(
    @Query() query: SearchTasksQueryDto,
  ): Promise<TaskSearchResultDto[]> {
    const results = await this.TasksService.searchTasks({
      query: query.query,
      limit: query.limit,
      threshold: query.threshold,
    });

    return results.map((result) => ({
      id: result.id,
      name: result.name,
      score: result.score,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiOkResponse({ type: TaskResponseDto, description: 'Task found' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async getTask(@Param() params: TaskParamsDto): Promise<TaskResponseDto> {
    const result = await this.TasksService.getTaskById(params.id);
    return TaskResponseDto.fromResult(result);
  }

  @Post(':id/comments')
  @RequireScopes(TasksScopes.WRITE.id)
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
    @CurrentUser() user: UserContext,
  ): Promise<CommentResponseDto> {
    const result = await this.TasksService.addComment(params.id, {
      commenterActorId: user.actorId,
      content: dto.content,
    });
    return CommentResponseDto.fromResult(result);
  }

  @Post(':id/artefacts')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Add an artefact to a task' })
  @ApiCreatedResponse({
    type: ArtefactResponseDto,
    description: 'Artefact added successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addArtefact(
    @Param() params: TaskParamsDto,
    @Body() dto: CreateArtefactDto,
    @CurrentUser() user: UserContext,
  ): Promise<ArtefactResponseDto> {
    const result = await this.TasksService.addArtefact(
      params.id,
      {
        name: dto.name,
        link: dto.link,
      },
      user.actorId,
    );
    return ArtefactResponseDto.fromResult(result);
  }

  @Patch(':id/status')
  @RequireScopes(TasksScopes.WRITE.id)
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
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.changeStatus(
      params.id,
      {
        status: dto.status,
        comment: dto.comment,
      },
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Post(':id/tags')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Add a tag to a task' })
  @ApiCreatedResponse({
    type: TaskResponseDto,
    description: 'Tag added to task successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToTask(
    @Param() params: TaskParamsDto,
    @Body() dto: CreateTagDto,
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.addTagToTask(
      params.id,
      { name: dto.name },
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Delete(':id/tags/:tagId')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Remove a tag from a task' })
  @ApiOkResponse({
    type: TaskResponseDto,
    description: 'Tag removed from task successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async removeTagFromTask(
    @Param('id') taskId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: UserContext,
  ): Promise<TaskResponseDto> {
    const result = await this.TasksService.removeTagFromTask(
      taskId,
      tagId,
      user.actorId,
    );
    return TaskResponseDto.fromResult(result);
  }

  @Post(':id/input-requests')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Create an input request for a task' })
  @ApiCreatedResponse({
    type: InputRequestResponseDto,
    description: 'Input request created successfully',
  })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createInputRequest(
    @Param() params: TaskParamsDto,
    @Body() dto: CreateInputRequestDto,
    @CurrentUser() user: UserContext,
  ): Promise<InputRequestResponseDto> {
    const result = await this.TasksService.createInputRequest({
      taskId: params.id,
      askedByActorId: user.actorId,
      assignedToActorId: dto.assignedToActorId,
      question: dto.question,
    });
    return InputRequestResponseDto.fromResult(result);
  }

  @Post(':id/input-requests/:inputRequestId/answer')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Answer an input request' })
  @ApiOkResponse({
    type: InputRequestResponseDto,
    description: 'Input request answered successfully',
  })
  @ApiNotFoundResponse({ description: 'Input request not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async answerInputRequest(
    @Param('id') taskId: string,
    @Param('inputRequestId') inputRequestId: string,
    @Body() dto: AnswerInputRequestDto,
    @CurrentUser() user: UserContext,
  ): Promise<InputRequestResponseDto> {
    const result = await this.TasksService.answerInputRequest(
      taskId,
      inputRequestId,
      {
        answer: dto.answer,
      },
      user.actorId,
    );
    return InputRequestResponseDto.fromResult(result);
  }

  @All('mcp')
  @RequireScopes(McpScopes.USE.id)
  async handleMcp(
    @CurrentUser() user: UserContext,
    @CurrentAuth() authContext: AuthContext,
    @CurrentExecutionId() executionId: string | undefined,
    @CurrentRunId() runId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.gateway.handleRequest(
      req,
      res,
      user,
      authContext,
      executionId,
      runId,
    );
  }
}
