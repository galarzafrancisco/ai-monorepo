import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AgentRunsService } from './agent-runs.service';
import { CreateAgentRunDto } from './dto/create-agent-run.dto';
import { UpdateAgentRunDto } from './dto/update-agent-run.dto';
import { AgentRunResponseDto } from './dto/agent-run-response.dto';
import { AgentRunListResponseDto } from './dto/agent-run-list-response.dto';
import { AgentRunParamsDto } from './dto/agent-run-params.dto';
import { ListAgentRunsQueryDto } from './dto/list-agent-runs-query.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { AgentRunsScopes } from './agent-runs.scopes';
import { CurrentUser } from 'src/auth/guards/decorators/current-user.decorator';
import type { UserContext } from 'src/auth/guards/context/auth-context.types';

/**
 * AgentRuns Controller - Legacy Compatibility Facade
 *
 * @deprecated This controller provides backward compatibility for workers using the legacy
 * run-based context model. New workers should use the execution-centric model with
 * TaskExecution and the execution-id header.
 *
 * **Migration Status**: Active compatibility facade during worker migration
 *
 * **Removal Criteria**: See /docs/AGENT_RUN_DEPRECATION.md for detailed removal criteria.
 * This facade will be removed once all workers are migrated to use execution-id and
 * metrics show zero usage of run-id for 30 days.
 *
 * **Current Behavior**:
 * - Maintains the `/api/v1/agent-runs` HTTP API for old workers
 * - AgentRun records may link to TaskExecution via taskExecutionId
 * - ExecutionContextResolverService handles dual-stack resolution (execution-id preferred, run-id fallback)
 * - Deprecation warnings logged when run-id path is used without execution-id
 *
 * @see ExecutionContextResolverService for context resolution logic
 * @see /docs/AGENT_RUN_DEPRECATION.md for deprecation plan
 * @see /docs/worker-server-run-tracking-redesign-plan.md for migration overview
 */
@ApiTags('AgentRun')
@ApiCookieAuth('JWT-Cookie')
@Controller('agent-runs')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentRunsScopes.READ.id)
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Post()
  @RequireScopes(AgentRunsScopes.WRITE.id)
  @ApiOperation({
    summary: 'Create a new agent run',
    deprecated: true,
    description:
      'DEPRECATED: This endpoint is a legacy compatibility facade. ' +
      'New workers should use the execution-centric model (TaskExecution) instead of creating AgentRuns. ' +
      'This endpoint will be removed once all workers migrate to execution-id. ' +
      'See /docs/AGENT_RUN_DEPRECATION.md for details.',
  })
  @ApiCreatedResponse({
    type: AgentRunResponseDto,
    description: 'Agent run created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createAgentRun(
    @Body() dto: CreateAgentRunDto,
    @CurrentUser() user: UserContext,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.createAgentRun({
      actorId: user.actorId,
      parentTaskId: dto.parentTaskId,
      taskExecutionId: dto.taskExecutionId,
    });
    return AgentRunResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'List agent runs with optional filters' })
  @ApiOkResponse({
    type: AgentRunListResponseDto,
    description: 'List of agent runs retrieved successfully',
  })
  async listAgentRuns(
    @Query() query: ListAgentRunsQueryDto,
  ): Promise<AgentRunListResponseDto> {
    const result = await this.agentRunsService.listAgentRuns({
      actorId: query.actorId,
      parentTaskId: query.parentTaskId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => AgentRunResponseDto.fromResult(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':runId')
  @ApiOperation({ summary: 'Get an agent run by ID' })
  @ApiOkResponse({
    type: AgentRunResponseDto,
    description: 'Agent run retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'Agent run not found' })
  async getAgentRunById(
    @Param() params: AgentRunParamsDto,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.getAgentRunById(params.runId);
    return AgentRunResponseDto.fromResult(result);
  }

  @Patch(':runId')
  @RequireScopes(AgentRunsScopes.WRITE.id)
  @ApiOperation({
    summary: 'Update an agent run',
    deprecated: true,
    description:
      'DEPRECATED: This endpoint is a legacy compatibility facade. ' +
      'Workers should update execution state via TaskExecution instead. ' +
      'See /docs/AGENT_RUN_DEPRECATION.md for migration details.',
  })
  @ApiOkResponse({
    type: AgentRunResponseDto,
    description: 'Agent run updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Agent run not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateAgentRun(
    @Param() params: AgentRunParamsDto,
    @Body() dto: UpdateAgentRunDto,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.updateAgentRun(params.runId, {
      startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
      endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
      lastPing: dto.lastPing ? new Date(dto.lastPing) : undefined,
      taskExecutionId: dto.taskExecutionId,
    });
    return AgentRunResponseDto.fromResult(result);
  }

}
