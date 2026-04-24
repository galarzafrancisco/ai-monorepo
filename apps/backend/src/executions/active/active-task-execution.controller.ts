import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
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
import { WorkersScopes } from '../workers.scopes';
import {
  ActiveTaskExecutionNotFoundError,
  ActiveTaskExecutionWorkerMismatchError,
  ExecutionStatsNotFoundError,
} from '../errors/executions.errors';
import { ActiveTaskExecutionService } from './active-task-execution.service';
import { ActiveTaskExecutionResponseDto } from './dto/http/active-task-execution-response.dto';
import { ActiveTaskExecutionListResponseDto } from './dto/http/active-task-execution-list-response.dto';
import { ListActiveExecutionsQueryDto } from './dto/http/list-active-executions-query.dto';
import { StopActiveTaskExecutionDto } from './dto/http/stop-active-task-execution.dto';
import { UpdateRunnerSessionIdDto } from './dto/http/update-runner-session-id.dto';
import { TaskExecutionHistoryResponseDto } from '../history/dto/http/task-execution-history-response.dto';
import { UpdateExecutionStatsDto } from './dto/http/update-execution-stats.dto';

@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions/active')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class ActiveTaskExecutionController {
  constructor(
    private readonly activeTaskExecutionService: ActiveTaskExecutionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active task executions',
    description:
      'Returns the tasks currently being worked on in the execution system with pagination.',
  })
  @ApiOkResponse({ type: ActiveTaskExecutionListResponseDto })
  async listActiveExecutions(
    @Query() query: ListActiveExecutionsQueryDto,
  ): Promise<ActiveTaskExecutionListResponseDto> {
    const result = await this.activeTaskExecutionService.listActiveExecutions({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      taskId: query.taskId,
    });

    return {
      items: result.items.map((item) =>
        ActiveTaskExecutionResponseDto.fromEntity(item),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Post(':executionId/stop')
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Stop an active task execution and move it to history',
    description:
      'Atomically removes the execution from the active execution table and inserts it into the history table.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to stop' })
  @ApiCreatedResponse({ type: TaskExecutionHistoryResponseDto })
  async stopTaskExecution(
    @Param('executionId') executionId: string,
    @Body() dto: StopActiveTaskExecutionDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<TaskExecutionHistoryResponseDto> {
    try {
      const historyEntry = await this.activeTaskExecutionService.stopTask({
        executionId,
        workerClientId: auth.claims.client_id,
        status: dto.status,
        errorCode: dto.errorCode,
        errorMessage: dto.errorMessage,
      });

      return TaskExecutionHistoryResponseDto.fromEntity(historyEntry);
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Post(':executionId/unclaim')
  @HttpCode(204)
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Unclaim an active task execution and return it to the queue',
    description:
      'Atomically removes the execution from the active execution table and returns its task to the execution queue. Only the worker that claimed the execution may unclaim it.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to unclaim' })
  async unclaimTaskExecution(
    @Param('executionId') executionId: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    try {
      await this.activeTaskExecutionService.unclaimTask({
        executionId,
        workerClientId: auth.claims.client_id,
      });
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof ActiveTaskExecutionWorkerMismatchError) {
        throw new ForbiddenException(error.message);
      }

      throw error;
    }
  }

  @Patch(':executionId/session')
  @HttpCode(204)
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Attach the runner session id to an active execution',
    description:
      'Stores the runtime session identifier emitted by the agent harness so it can be propagated to execution history.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to update' })
  async updateRunnerSessionId(
    @Param('executionId') executionId: string,
    @Body() dto: UpdateRunnerSessionIdDto,
  ): Promise<void> {
    try {
      await this.activeTaskExecutionService.updateRunnerSessionId({
        executionId,
        runnerSessionId: dto.sessionId,
      });
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Patch(':executionId/tool-calls/increment')
  @HttpCode(204)
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Increment tool call count for an active execution',
    description:
      'Atomically increments the active execution tool-call counter without touching other mutable execution fields.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to update' })
  async incrementToolCallCount(
    @Param('executionId') executionId: string,
  ): Promise<void> {
    try {
      await this.activeTaskExecutionService.incrementToolCallCount({
        executionId,
      });
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Patch(':executionId/stats')
  @HttpCode(204)
  @RequireScopes(WorkersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Patch execution stats and metadata',
    description:
      'Atomically updates one or more execution metadata fields such as harness, model details, or token usage.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to update' })
  async updateExecutionStats(
    @Param('executionId') executionId: string,
    @Body() dto: UpdateExecutionStatsDto,
  ): Promise<void> {
    try {
      await this.activeTaskExecutionService.updateExecutionStats({
        executionId,
        harness: dto.harness,
        providerId: dto.providerId,
        modelId: dto.modelId,
        inputTokens: dto.inputTokens,
        outputTokens: dto.outputTokens,
        totalTokens: dto.totalTokens,
      });
    } catch (error) {
      if (error instanceof ExecutionStatsNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Post(':executionId/interrupt')
  @HttpCode(204)
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({
    summary: 'Request interruption of an active execution',
    description:
      'Signals the worker to abort the currently running agent execution.',
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID to interrupt' })
  async interruptExecution(
    @Param('executionId') executionId: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    try {
      await this.activeTaskExecutionService.interruptExecution(
        { executionId },
        auth.subject,
      );
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
