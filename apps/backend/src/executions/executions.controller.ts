import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ExecutionsService } from './executions.service';
import { ExecutionListResponseDto } from './dto/http/execution-list-response.dto';
import { ExecutionResponseDto } from './dto/http/execution-response.dto';
import { ListExecutionsQueryDto } from './dto/http/list-executions-query.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';

/**
 * ExecutionsController
 *
 * Provides read-only access to TaskExecution state for debug/monitoring.
 * This is a rustic debug UI to visualize the backend-tracked work queue.
 */
@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id) // Reuse tasks:read scope for now
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List task executions with optional filtering and pagination',
    description:
      'Returns the backend-tracked work queue showing all TaskExecution records. ' +
      'Useful for debugging the execution reconciler and understanding which tasks are ready to run.',
  })
  @ApiOkResponse({ type: ExecutionListResponseDto })
  async listExecutions(
    @Query() query: ListExecutionsQueryDto,
  ): Promise<ExecutionListResponseDto> {
    const result = await this.executionsService.listExecutions({
      status: query.status,
      agentActorId: query.agentActorId,
      taskId: query.taskId,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map((item) => ExecutionResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }
}
