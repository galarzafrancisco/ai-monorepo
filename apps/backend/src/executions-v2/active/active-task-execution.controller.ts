import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
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
import { WorkersScopes } from '../../executions/workers.scopes';
import { ActiveTaskExecutionNotFoundError } from '../errors/executions-v2.errors';
import { ActiveTaskExecutionService } from './active-task-execution.service';
import { ActiveTaskExecutionResponseDto } from './dto/http/active-task-execution-response.dto';
import { StopActiveTaskExecutionDto } from './dto/http/stop-active-task-execution.dto';
import { TaskExecutionHistoryResponseDto } from '../history/dto/http/task-execution-history-response.dto';

@ApiTags('Executions V2')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions-v2/active')
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
      'Returns the tasks currently being worked on in the v2 execution system.',
  })
  @ApiOkResponse({ type: [ActiveTaskExecutionResponseDto] })
  async listActiveExecutions(): Promise<ActiveTaskExecutionResponseDto[]> {
    const executions = await this.activeTaskExecutionService.listActiveExecutions();
    return executions.map((execution) =>
      ActiveTaskExecutionResponseDto.fromEntity(execution),
    );
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
      });

      return TaskExecutionHistoryResponseDto.fromEntity(historyEntry);
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
