import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/guards/decorators/current-auth.decorator';
import { CurrentWorkspace } from '../../auth/guards/decorators/current-workspace.decorator';
import { AccessTokenGuard } from '../../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../../auth/guards/decorators/require-scopes.decorator';
import type { AuthContext } from '../../auth/guards/context/auth-context.types';
import { TasksScopes } from '../../tasks/tasks.scopes';
import { WorkersScopes } from '../workers.scopes';
import { ActiveTaskExecutionResponseDto } from '../active/dto/http/active-task-execution-response.dto';
import { ActiveTaskExecutionService } from '../active/active-task-execution.service';
import { TaskExecutionQueueService } from './task-execution-queue.service';
import { TaskExecutionQueueEntryResponseDto } from './dto/http/task-execution-queue-entry-response.dto';
import { TaskExecutionQueueListResponseDto } from './dto/http/task-execution-queue-list-response.dto';
import { ListQueueQueryDto } from './dto/http/list-queue-query.dto';
import { TaskExecutionQueueEntryResult } from '../dto/service/execution-results.service.types';
import { WorkspaceAccess } from '../../auth/guards/decorators/workspace-access.decorator';

@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
@WorkspaceAccess('scoped')
@Controller('executions/queue')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class TaskExecutionQueueController {
  constructor(
    private readonly taskExecutionQueueService: TaskExecutionQueueService,
    private readonly activeTaskExecutionService: ActiveTaskExecutionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the current task execution work queue',
    description:
      'Returns the tasks currently present in the execution queue with pagination. ' +
      'Presence means the task is ready to be picked by the executor.',
  })
  @ApiOkResponse({ type: TaskExecutionQueueListResponseDto })
  async listQueue(
    @Query() query: ListQueueQueryDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<TaskExecutionQueueListResponseDto> {
    const result = await this.taskExecutionQueueService.listQueue(workspaceId, {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });

    return {
      items: result.items.map((item) => this.mapQueueEntryToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Post(':taskId/claim')
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Claim a specific task from the execution queue',
    description:
      'Atomically removes the task from the queue and inserts it into the active execution table.',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID to claim' })
  @ApiCreatedResponse({ type: ActiveTaskExecutionResponseDto })
  @ApiNotFoundResponse({
    description: 'Task not found (TASK_NOT_FOUND) or not in the queue (TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND)',
  })
  @ApiConflictResponse({
    description:
      'Task already has an active execution (TASK_EXECUTION_ALREADY_CLAIMED) or its agent is at its concurrency limit (AGENT_CONCURRENCY_LIMIT_REACHED)',
  })
  async claimTask(
    @Param('taskId') taskId: string,
    @CurrentAuth() auth: AuthContext,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ActiveTaskExecutionResponseDto> {
    const execution = await this.activeTaskExecutionService.claimTask(workspaceId, {
      taskId,
      workerClientId: auth.claims.client_id,
    });

    return ActiveTaskExecutionResponseDto.fromResult(execution);
  }

  private mapQueueEntryToResponse(
    entry: TaskExecutionQueueEntryResult,
  ): TaskExecutionQueueEntryResponseDto {
    return {
      taskId: entry.taskId,
      taskName: entry.taskName,
      taskStatus: entry.taskStatus,
    };
  }
}
