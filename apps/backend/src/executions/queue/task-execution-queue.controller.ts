import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/guards/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../../auth/guards/decorators/require-scopes.decorator';
import type { AuthContext } from '../../auth/guards/context/auth-context.types';
import { TasksScopes } from '../../tasks/tasks.scopes';
import { TaskNotFoundError } from '../../tasks/errors/tasks.errors';
import { WorkersScopes } from '../workers.scopes';
import { ActiveTaskExecutionResponseDto } from '../active/dto/http/active-task-execution-response.dto';
import { ActiveTaskExecutionService } from '../active/active-task-execution.service';
import {
  TaskAlreadyClaimedError,
  TaskExecutionQueueEntryNotFoundError,
} from '../errors/executions.errors';
import { TaskExecutionQueueService } from './task-execution-queue.service';
import { TaskExecutionQueueEntryResponseDto } from './dto/http/task-execution-queue-entry-response.dto';
import { TaskExecutionQueueListResponseDto } from './dto/http/task-execution-queue-list-response.dto';
import { ListQueueQueryDto } from './dto/http/list-queue-query.dto';
import { TaskExecutionQueueEntryResult } from '../dto/service/execution-results.service.types';

@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
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
  ): Promise<TaskExecutionQueueListResponseDto> {
    const result = await this.taskExecutionQueueService.listQueue({
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
  async claimTask(
    @Param('taskId') taskId: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<ActiveTaskExecutionResponseDto> {
    try {
      const execution = await this.activeTaskExecutionService.claimTask({
        taskId,
        workerClientId: auth.claims.client_id,
      });

      return ActiveTaskExecutionResponseDto.fromResult(execution);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof TaskExecutionQueueEntryNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof TaskAlreadyClaimedError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
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
